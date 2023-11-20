import { Subscription } from "models/subscription";
import { NextFunction, Request, Response } from "express";
import { getInstallations, InstallationResults } from "utils/github-installations-helper";
import { Octokit } from "@octokit/rest";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import Logger from "bunyan";
import { AppInstallation } from "config/interfaces";
import { envVars } from "config/env";
import { GitHubUserClient } from "~/src/github/client/github-user-client";
import { isUserAdminOfOrganization } from "utils/github-utils";
import { GithubClientBlockedIpError, GithubClientSSOLoginError } from "~/src/github/client/github-client-errors";
import { createInstallationClient, createUserClient } from "~/src/util/get-github-client-config";
import { GitHubServerApp } from "models/github-server-app";
import { sendAnalytics } from "utils/analytics-client";
import { AnalyticsEventTypes, AnalyticsScreenEventsEnum } from "interfaces/common";
import {
	registerSubscriptionDeferredInstallPayloadRequest,
	SubscriptionDeferredInstallPayload
} from "services/subscription-deferred-install-service";
import { errorStringFromUnknown } from "~/src/util/error-string-from-unknown";

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

export interface MergedInstallation extends InstallationWithAdmin {
	syncStatus?: string;
}

const mergeByLogin = (installationsWithAdmin: InstallationWithAdmin[], connectedStatuses: ConnectedStatus[]): MergedInstallation[] =>
	connectedStatuses.length ? installationsWithAdmin.map((installation) => ({
		...connectedStatuses.find(
			(connection) => connection.account.login === installation.account.login
		),
		...installation
	})) : installationsWithAdmin;

export const installationConnectedStatus = async (
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

export const getInstallationsWithAdmin = async (
	installationIdPk: number,
	gitHubUserClient: GitHubUserClient,
	log: Logger,
	login: string,
	installations: Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem[] = [],
	jiraHost: string,
	gitHubAppId: number | undefined,
	gitHubAppUuid: string | undefined
): Promise<InstallationWithAdmin[]> => {
	return await Promise.all(installations.map(async (installation) => {
		const errors: Error[] = [];
		const gitHubClient = await createInstallationClient(installation.id, jiraHost, { trigger: "github-configuration-get" }, log, gitHubAppId);

		const numberOfReposPromise = await gitHubClient.getNumberOfReposForInstallation().catch((err) => {
			errors.push(err);
			return 0;
		});

		// See if we can get the membership for this user
		// TODO: instead of calling each installation org to see if the current user is admin, you could just ask for
		//  all orgs the user is a member of and cross reference with the installation org
		const checkAdmin = isUserAdminOfOrganization(
			gitHubUserClient,
			gitHubClient,
			installation.account.login,
			login,
			installation.target_type,
			log
		).catch(err => {
			errors.push(err);
			return false;
		});
		const [isAdmin, numberOfRepos] = await Promise.all([checkAdmin, numberOfReposPromise]);
		log.info(`Number of repos in the org received via GraphQL: ${numberOfRepos}`);

		let deferredInstallUrl: string | undefined;

		// TODO: we should register the request in a separate POST endpoint. Short-cutting corners now for the spike,
		// TODO: but must be addressed before rolling out for everyone, to avoid polluting redis
		if (await booleanFlag(BooleanFlags.ENABLE_SUBSCRIPTION_DEFERRED_INSTALL, jiraHost) && !isAdmin) {
			const payload: SubscriptionDeferredInstallPayload = {
				installationIdPk,
				gitHubInstallationId: installation.id,
				orgName: installation.account.login,
				gitHubServerAppIdPk: gitHubAppId
			};
			const requestId = await registerSubscriptionDeferredInstallPayloadRequest(payload);
			deferredInstallUrl = `${envVars.APP_URL}/github/${gitHubAppUuid ? (gitHubAppUuid + "/") : ""}subscription-deferred-install/request/${requestId}`;
		}

		return {
			...installation,
			numberOfRepos,
			isAdmin,
			requiresSsoLogin: errors.some(err=>err instanceof GithubClientSSOLoginError),
			isIPBlocked: errors.some(err=>err instanceof GithubClientBlockedIpError),
			deferredInstallUrl
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
			} catch (err: unknown) {
				const deleteSubscriptionError = `Failed to delete subscription: ${errorStringFromUnknown(err)}`;
				logger.error({ err }, deleteSubscriptionError);
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

	const { uuid: gitHubAppUuid } = gitHubAppConfig;
	const gitHubAppId: number = gitHubAppConfig.gitHubAppId;

	gitHubAppId ? req.log.debug(`Displaying orgs that have GitHub Enterprise app ${gitHubAppId} installed.`)
		: req.log.debug("Displaying orgs that have GitHub Cloud app installed.");

	const gitHubProduct = gitHubAppId ? "server" : "cloud";

	req.log.info({ method: req.method, requestUrl: req.originalUrl }, `Request for type ${gitHubProduct}`);

	await sendAnalytics(jiraHost, AnalyticsEventTypes.ScreenEvent, {
		name: AnalyticsScreenEventsEnum.ConnectAnOrgScreenEventName
	},
	{
		jiraHost,
		gitHubProduct
	});

	const gitHubUserClient = await createUserClient(githubToken, jiraHost, { trigger: "github-configuration-get" }, log, gitHubAppId);
	req.log.info(`githubUserClient created in ${(new Date().getTime() - requestStartTime) / 1000} seconds`);

	const { data: { login } } = await gitHubUserClient.getUser();
	req.log.debug(`got login name: ${login}`);
	req.log.info(`getUser fetched in ${(new Date().getTime() - requestStartTime) / 1000} seconds`);

	try {

		const { data: { installations }, headers } = await gitHubUserClient.getInstallations();
		req.log.info(`installations fetched in ${(new Date().getTime() - requestStartTime) / 1000} seconds`);

		if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost)) {
			log.info({ installations, headers }, `verbose logging: listInstallationsForAuthenticatedUser`);
		}

		req.log.debug(`got user's installations from GitHub`);

		const installationsWithAdmin = await getInstallationsWithAdmin(
			res.locals.installation.id,
			gitHubUserClient, log, login, installations, jiraHost, gitHubAppId, gitHubAppConfig.uuid
		);
		req.log.info(`installationsWithAdmin fetched in ${(new Date().getTime() - requestStartTime) / 1000} seconds`);

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
		req.log.info(`connectedInstallations fetched in ${(new Date().getTime() - requestStartTime) / 1000} seconds`);

		// Sort to that orgs ready to be connected are at the top
		const rankInstallation = (i: MergedInstallation) => Number(i.isAdmin) - Number(i.isIPBlocked) + 3 * Number(i.syncStatus !== "FINISHED" && i.syncStatus !== "IN PROGRESS" && i.syncStatus !== "PENDING");
		const sortedInstallation = connectedInstallations.sort((a, b) => rankInstallation(b) - rankInstallation(a));

		if (await booleanFlag(BooleanFlags.VERBOSE_LOGGING, jiraHost)) {
			log.info({ connectedInstallations }, `verbose logging: connectedInstallations`);
		}

		req.log.debug(`got connected installations`);

		res.render("github-configuration.hbs", {
			csrfToken: req.csrfToken(),
			installations: sortedInstallation,
			jiraHost,
			nonce: res.locals.nonce,
			clientKey: res.locals.installation.clientKey,
			login,
			repoUrl: envVars.GITHUB_REPO_URL,
			gitHubServerApp: gitHubAppId ? await GitHubServerApp.getForGitHubServerAppId(gitHubAppId) : null,
			gitHubAppUuid
		});

		req.log.info({ method: req.method, requestUrl: req.originalUrl }, `Request finished in ${(new Date().getTime() - requestStartTime) / 1000} seconds`);
		req.log.debug(`rendered page`);

	} catch (err: unknown) {
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
	requiresSsoLogin: boolean;
	isIPBlocked: boolean;
	deferredInstallUrl?: string;
}
