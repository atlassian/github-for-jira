import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { NextFunction, Request, Response } from "express";
import { getInstallations, InstallationResults } from "../../jira/configuration/jira-configuration-get";
import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { Errors } from "config/errors";
import { Tracer } from "config/tracer";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { GitHubAppClient } from "~/src/github/client/github-app-client";
import Logger from "bunyan";
import { getCloudInstallationId } from "~/src/github/client/installation-id";
import { AppInstallation } from "config/interfaces";
import { envVars } from "config/env";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { BlockedIpError } from "~/src/github/client/github-client-errors";

interface ConnectedStatus {
	// TODO: really need to type this sync status
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
			syncStatus: installation.syncStatus,
			account: installation.account
		}));

interface MergedInstallation extends InstallationWithAdmin {
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
	client: GitHubAPI,
	installationsWithAdmin: InstallationWithAdmin[],
	reqLog: Logger
): Promise<MergedInstallation[]> => {
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const installationsWithSubscriptions = await getInstallations(client, subscriptions, reqLog);
	const connectedStatuses = getConnectedStatus(installationsWithSubscriptions.fulfilled, jiraHost);

	return mergeByLogin(installationsWithAdmin, connectedStatuses);
};

const getInstallationsWithAdmin = async (
	gitHubUserClient: GitHubUserClient,
	log: Logger,
	login: string,
	installations: Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem[] = []
): Promise<InstallationWithAdmin[]> => {
	return await Promise.all(installations.map(async (installation) => {
		const errors: Error[] = [];
		const gitHubInstallationClient = new GitHubInstallationClient(getCloudInstallationId(installation.id), log);
		const numberOfReposPromise = gitHubInstallationClient.getNumberOfReposForInstallation().catch((err) => {
			errors.push(err);
			return 0;
		});
		// See if we can get the membership for this user
		// TODO: instead of calling each installation org to see if the current user is admin, you could just ask for all orgs the user is a member of and cross reference with the installation org
		const checkAdmin = isUserAdminOfOrganization(
			gitHubUserClient,
			installation.account.login,
			login,
			installation.target_type
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
			isIPBlocked: !!errors.find(err => err instanceof BlockedIpError)
		};
	}));
};

const removeFailedConnectionsFromDb = async (req: Request, installations: InstallationResults, jiraHost: string): Promise<void> => {
	await Promise.all(installations.rejected
		// Only uninstall deleted installations
		.filter(failedInstallation => failedInstallation.deleted)
		.map(async (failedInstallation) => {
			try {
				await Subscription.uninstall({
					installationId: failedInstallation.id,
					host: jiraHost
				});
			} catch (err) {
				const deleteSubscriptionError = `Failed to delete subscription: ${err}`;
				req.log.error(deleteSubscriptionError);
			}
		}));
};

export const GithubConfigurationGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const {
		jiraHost,
		githubToken,
		github, // user-authenticated GitHub client
		client // app-authenticated GitHub client
	} = res.locals;
	const log = req.log.child({ jiraHost });

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	const useNewGitHubClient = await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_GITHUB_CONFIG, true);
	const githubUserClient = new GitHubUserClient(githubToken, log);

	const traceLogsEnabled = await booleanFlag(BooleanFlags.TRACE_LOGGING, false);
	const tracer = new Tracer(log, "get-github-configuration", traceLogsEnabled);

	tracer.trace("found github token");

	if (!jiraHost) {
		return next(new Error(Errors.MISSING_JIRA_HOST));
	}

	tracer.trace(`found jira host: ${jiraHost}`);

	const { data: { login } } = useNewGitHubClient ? await githubUserClient.getUser() : await github.users.getAuthenticated();

	tracer.trace(`got login name: ${login}`);

	// Remove any failed installations before a user attempts to reconnect
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	const allInstallations = await getInstallations(client, subscriptions, log);
	await removeFailedConnectionsFromDb(req, allInstallations, jiraHost);

	tracer.trace(`removed failed installations`);

	try {

		// we can get the jira client Key from the JWT's `iss` property
		// so we'll decode the JWT here and verify it's the right key before continuing
		const installation = await Installation.getForHost(jiraHost);
		if (!installation) {
			tracer.trace(`missing installation`);
			log.warn({ req, res }, "Missing installation");
			res.status(404).send(`Missing installation for host '${jiraHost}'`);
			return;
		}
		const gitHubAppClient = new GitHubAppClient(log);

		tracer.trace(`found installation in DB with id ${installation.id}`);

		const { data: { installations }, headers } = useNewGitHubClient ?
			await githubUserClient.getInstallations() :
			await github.apps.listInstallationsForAuthenticatedUser();

		if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, false, jiraHost)) {
			log.info({ installations, headers }, `verbose logging: listInstallationsForAuthenticatedUser`);
		}

		tracer.trace(`got user's installations from GitHub`);

		const installationsWithAdmin = await getInstallationsWithAdmin(githubUserClient, log, login, installations);

		if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, false, jiraHost)) {
			log.info(`verbose logging: installationsWithAdmin: ${JSON.stringify(installationsWithAdmin)}`);
		}

		tracer.trace(`got user's installations with admin status from GitHub`);
		const { data: info } = await gitHubAppClient.getApp(); //(client as GitHubAPI).apps.getAuthenticated();
		tracer.trace(`got user's authenticated apps from GitHub`);

		if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, false, jiraHost)) {
			log.info({ info }, `verbose logging: getAuthenticated`);
		}

		const connectedInstallations = await installationConnectedStatus(
			jiraHost,
			client,
			installationsWithAdmin,
			log
		);

		// Sort to that orgs ready to be connected are at the top
		const rankInstallation = (i: MergedInstallation) => Number(i.isAdmin) - Number(i.isIPBlocked) + 3 * Number(i.syncStatus !== "FINISHED" && i.syncStatus !== "IN PROGRESS" && i.syncStatus !== "PENDING");
		const sortedInstallation = connectedInstallations.sort((a, b) => rankInstallation(b) - rankInstallation(a));

		if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, false, jiraHost)) {
			log.info({ connectedInstallations }, `verbose logging: connectedInstallations`);
		}

		tracer.trace(`got connected installations`);

		res.render("github-configuration.hbs", {
			csrfToken: req.csrfToken(),
			installations: sortedInstallation,
			jiraHost,
			nonce: res.locals.nonce,
			info,
			clientKey: installation.clientKey,
			login,
			repoUrl: envVars.GITHUB_REPO_URL
		});

		tracer.trace(`rendered page`);

	} catch (err) {
		// If we get here, there was either a problem decoding the JWT
		// or getting the data we need from GitHub, so we'll show the user an error.
		tracer.trace(`Error while getting github configuration page`);
		log.error({ err, req, res }, "Error while getting github configuration page");
		return next(err);
	}
};

interface InstallationWithAdmin extends Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem {
	numberOfRepos: number;
	isAdmin: boolean;
	isIPBlocked: boolean;
}
