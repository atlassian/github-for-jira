import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { NextFunction, Request, Response } from "express";
import { getInstallations, InstallationResults } from "routes/jira/jira-get";
import { Octokit } from "@octokit/rest";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { Errors } from "config/errors";
import Logger from "bunyan";
import { AppInstallation } from "config/interfaces";
import { envVars } from "config/env";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { GithubClientBlockedIpError } from "~/src/github/client/github-client-errors";
import {
	createInstallationClient,
	createUserClient
} from "~/src/util/get-github-client-config";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";

interface ConnectedStatus {
	// TODO: really need to type this sync status
	subscriptionId?: number;
	syncStatus?: string;
	account: Octokit.AppsGetInstallationResponseAccount;
}

const getConnectedStatus = (
	installationsWithSubscriptions: AppInstallation[],
	jiraHost: string
): ConnectedStatus[] =>
	installationsWithSubscriptions
		// An org may have multiple subscriptions to Jira instances. Confirm a match.
		.filter((installation) => jiraHost === installation.jiraHost)
		.map((installation) => ({
			subscriptionId: installation.subscriptionId,
			syncStatus: installation.syncStatus,
			account: installation.account
		}));

interface MergedInstallation extends InstallationWithAdmin {
	subscriptionId?: number;
	syncStatus?: string;
}

const mergeByLogin = (installationsWithAdmin: InstallationWithAdmin[], connectedStatuses: ConnectedStatus[]): MergedInstallation[] =>
	connectedStatuses.length ? installationsWithAdmin.map((installation) => ({
		...connectedStatuses.find(
			(connection) => connection.account.login === installation.account.login
		),
		...installation
	})) : installationsWithAdmin;

const installationConnectedStatus = async (
	jiraHost: string,
	installationsWithAdmin: InstallationWithAdmin[],
	log: Logger,
	gitHubAppId: number | undefined
): Promise<MergedInstallation[]> => {
	const subscriptions = await Subscription.getAllForHost(jiraHost, gitHubAppId);
	const installationsWithSubscriptions = await getInstallations(subscriptions, log, gitHubAppId);
	await removeFailedConnectionsFromDb(log, installationsWithSubscriptions, jiraHost, gitHubAppId);
	log.debug("Removed failed installations");

	const connectedStatuses = getConnectedStatus(installationsWithSubscriptions.fulfilled, jiraHost);

	return mergeByLogin(installationsWithAdmin, connectedStatuses);
};

const getInstallationsWithAdmin = async (
	gitHubUserClient: GitHubUserClient,
	log: Logger,
	login: string,
	installations: Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem[] = [],
	jiraHost: string,
	gitHubAppId: number | undefined
): Promise<InstallationWithAdmin[]> => {
	return await Promise.all(installations.map(async (installation) => {
		const errors: Error[] = [];
		const gitHubClient = await createInstallationClient(installation.id, jiraHost, { trigger: "github-configuration-get" }, log, gitHubAppId);

		const numberOfReposPromise = await gitHubClient.getNumberOfReposForInstallation().catch((err) => {
			errors.push(err);
			return 0;
		});

		// See if we can get the membership for this user
		// TODO: instead of calling each installation org to see if the current user is admin, you could just ask for all orgs the user is a member of and cross reference with the installation org
		const checkAdmin = isUserAdminOfOrganization(
			gitHubUserClient,
			installation.account.login,
			login,
			installation.target_type,
			log
		).catch(err => {
			errors.push(err);
			return false;
		});
		const [isAdmin, numberOfRepos] = await Promise.all([checkAdmin, numberOfReposPromise]);
		log.info("Number of repos in the org received via GraphQL: " + numberOfRepos);

		return {
			...installation,
			numberOfRepos,
			isAdmin,
			isIPBlocked: !!errors.find(err => err instanceof GithubClientBlockedIpError)
		};
	}));
};

const removeFailedConnectionsFromDb = async (logger: Logger, installations: InstallationResults, jiraHost: string, gitHubAppId: number | undefined): Promise<void> => {
	await Promise.all(installations.rejected
		// Only uninstall deleted installations
		.filter(failedInstallation => failedInstallation.deleted)
		.map(async (failedInstallation) => {
			try {
				await Subscription.uninstall({
					installationId: failedInstallation.id,
					host: jiraHost,
					gitHubAppId
				});
			} catch (err) {
				const deleteSubscriptionError = `Failed to delete subscription: ${err}`;
				logger.error(deleteSubscriptionError);
			}
		}));
};

export const GithubConfigurationGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started");
	const requestStartTime = new Date().getTime();

	const {
		jiraHost,
		githubToken,
		gitHubAppConfig
	} = res.locals;

	const log = req.log.child({ jiraHost });

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	const { gitHubAppId, uuid: gitHubAppUuid } = gitHubAppConfig;

	gitHubAppId ? req.log.debug(`Displaying orgs that have GitHub Enterprise app ${gitHubAppId} installed.`)
		: req.log.debug("Displaying orgs that have GitHub Cloud app installed.");

	const gitHubProduct = gitHubAppId ? "server" : "cloud";

	req.log.info({ method: req.method, requestUrl: req.originalUrl }, `Request for type ${gitHubProduct}`);

	sendAnalytics(AnalyticsEventTypes.ScreenEvent, {
		name: AnalyticsScreenEventsEnum.ConnectAnOrgScreenEventName,
		jiraHost,
		gitHubProduct
	});

	const gitHubUserClient = await createUserClient(githubToken, jiraHost, { trigger: "github-configuration-get" }, log, gitHubAppId);

	req.log.debug("found github token");

	if (!jiraHost) {
		req.log.warn({ req, res }, Errors.MISSING_JIRA_HOST);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return next();
	}

	req.log.debug(`found jira host: ${jiraHost}`);

	const { data: { login } } = await gitHubUserClient.getUser();

	req.log.debug(`got login name: ${login}`);

	try {

		// we can get the jira client Key from the JWT's `iss` property
		// so we'll decode the JWT here and verify it's the right key before continuing
		const installation = await Installation.getForHost(jiraHost);
		if (!installation) {
			req.log.debug(`missing installation`);
			log.warn({ req, res }, "Missing installation");
			res.status(404).send(`Missing installation for host '${jiraHost}'`);
			return;
		}

		req.log.debug(`found installation in DB with id ${installation.id}`);

		const { data: { installations }, headers } = await gitHubUserClient.getInstallations();

		if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost)) {
			log.info({ installations, headers }, `verbose logging: listInstallationsForAuthenticatedUser`);
		}

		req.log.debug(`got user's installations from GitHub`);

		const installationsWithAdmin = await getInstallationsWithAdmin(gitHubUserClient, log, login, installations, jiraHost, gitHubAppId);

		if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost)) {
			log.info(`verbose logging: installationsWithAdmin: ${JSON.stringify(installationsWithAdmin)}`);
		}

		req.log.debug(`got user's installations with admin status from GitHub`);

		const connectedInstallations = await installationConnectedStatus(
			jiraHost,
			installationsWithAdmin,
			log,
			gitHubAppId
		);

		// Sort to that orgs ready to be connected are at the top
		const rankInstallation = (i: MergedInstallation) => Number(i.isAdmin) - Number(i.isIPBlocked) + 3 * Number(i.syncStatus !== "FINISHED" && i.syncStatus !== "IN PROGRESS" && i.syncStatus !== "PENDING");
		const sortedInstallation = connectedInstallations.sort((a, b) => rankInstallation(b) - rankInstallation(a));

		if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost)) {
			log.info({ connectedInstallations }, `verbose logging: connectedInstallations`);
		}

		req.log.debug(`got connected installations`);

		if (req.query["type"] === "api") {
			res.json({ installations: sortedInstallation });
			return;
		}

		res.render("github-configuration.hbs", {
			csrfToken: req.csrfToken(),
			installations: sortedInstallation,
			jiraHost,
			nonce: res.locals.nonce,
			clientKey: installation.clientKey,
			login,
			repoUrl: envVars.GITHUB_REPO_URL,
			gitHubServerApp: gitHubAppId ? await GitHubServerApp.getForGitHubServerAppId(gitHubAppId) : null,
			gitHubAppUuid
		});

		req.log.info({ method: req.method, requestUrl: req.originalUrl }, `Request finished in ${(new Date().getTime() - requestStartTime) / 1000} seconds`);
		req.log.debug(`rendered page`);

	} catch (err) {
		// If we get here, there was either a problem decoding the JWT
		// or getting the data we need from GitHub, so we'll show the user an error.
		req.log.debug(`Error while getting github configuration page`);
		log.error({ err, req, res }, "Error while getting github configuration page");
		return next(err);
	}
};

interface InstallationWithAdmin extends Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem {
	numberOfRepos: number;
	isAdmin: boolean;
	isIPBlocked: boolean;
}
