import { Installation, Subscription } from "../models";
import { NextFunction, Request, Response } from "express";
import enhanceOctokit from "../config/enhance-octokit";
import app from "../worker/app";
import { getInstallation } from "./get-jira-configuration";
import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { booleanFlag, BooleanFlags } from "../config/feature-flags";
import { Errors } from "../config/errors";
import { Tracer } from "../config/tracer";

const getConnectedStatus = (
	installationsWithSubscriptions: any,
	sessionJiraHost: string
) => {
	return (
		installationsWithSubscriptions.length > 0 &&
		installationsWithSubscriptions
			// An org may have multiple subscriptions to Jira instances. Confirm a match.
			.filter((subscription) => sessionJiraHost === subscription.jiraHost)
			.map((subscription) =>
				(({ syncStatus, account }) => ({ syncStatus, account }))(subscription)
			)
	);
};

const mergeByLogin = (installationsWithAdmin: any, connectedStatuses: any) =>
	connectedStatuses ? installationsWithAdmin.map((installation) => ({
		...connectedStatuses.find(
			(connection) =>
				connection.account.login === installation.account.login && connection
		),
		...installation
	})) : installationsWithAdmin;

const installationConnectedStatus = async (
	sessionJiraHost: string,
	client: any,
	installationsWithAdmin: any,
	reqLog: any
) => {
	const subscriptions = await Subscription.getAllForHost(sessionJiraHost);

	const installationsWithSubscriptions = await Promise.all(
		subscriptions.map((subscription) => getInstallation(client, subscription, reqLog))
	);

	const connectedStatuses = getConnectedStatus(
		installationsWithSubscriptions,
		sessionJiraHost
	);

	return mergeByLogin(installationsWithAdmin, connectedStatuses);
};

async function getInstallationsWithAdmin(installations: Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem[], login: string, isAdmin: (args: { org: string, username: string, type: string }) => Promise<boolean>): Promise<InstallationWithAdmin[]> {
	const installationsWithAdmin: InstallationWithAdmin[] = [];

	for (const installation of installations) {
		// See if we can get the membership for this user
		// TODO: instead of calling each installation org to see if the current user is admin, you could just ask for all orgs the user is a member of and cross reference with the installation org
		const checkAdmin = isAdmin({
			org: installation.account.login,
			username: login,
			type: installation.target_type
		});

		const authedApp = await app.auth(installation.id);
		enhanceOctokit(authedApp);

		const repositories = authedApp.paginate(
			authedApp.apps.listRepos.endpoint.merge({ per_page: 100 }),
			(res) => res.data
		);

		const [admin, numberOfRepos] = await Promise.all([checkAdmin, repositories]);

		installationsWithAdmin.push({
			...installation,
			numberOfRepos: numberOfRepos.length || 0,
			admin
		});
	}
	return installationsWithAdmin;
}

const getAllInstallations = async (client, logger, jiraHost) => {
	const subscriptions = await Subscription.getAllForHost(jiraHost);
	return Promise.all(
		subscriptions.map((subscription) =>
			getInstallation(client, subscription, logger)
		)
	);
}

const removeFailedConnectionsFromDb = async (req: Request, installations: any, jiraHost: string): Promise<void> => {
	await Promise.all(installations
		.filter((response) => !!response.error)
		.map(async (connection) => {
			try {
				const payload = {
					installationId: connection.id,
					host: jiraHost,
				};
				await Subscription.uninstall(payload);
			} catch (err) {
				const deleteSubscriptionError = `Failed to delete subscription: ${err}`;
				req.log.error(deleteSubscriptionError);
			}
		}));
};

export default async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { jiraHost, githubToken } = req.session;
	const log = req.log.child({ jiraHost });

	if (!githubToken) {
		return next(new Error(Errors.MISSING_GITHUB_TOKEN));
	}

	const traceLogsEnabled = await booleanFlag(BooleanFlags.TRACE_LOGGING, false);
	const tracer = new Tracer(log, "get-github-configuration", traceLogsEnabled);

	tracer.trace("found github token");

	if (!jiraHost) {
		return next(new Error(Errors.MISSING_JIRA_HOST));
	}

	tracer.trace(`found jira host: ${jiraHost}`);

	const github: GitHubAPI = res.locals.github;
	const client: GitHubAPI = res.locals.client;
	const isAdmin = res.locals.isAdmin;

	tracer.trace(`isAdmin: ${isAdmin}`);

	const { data: { login } } = await github.users.getAuthenticated();

	tracer.trace(`got login name: ${login}`);

	// Remove any failed installations before a user attempts to reconnect
	const allInstallations = await getAllInstallations(client, log, jiraHost)
	await removeFailedConnectionsFromDb(req, allInstallations, jiraHost)

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

		tracer.trace(`found installation in DB with id ${installation.id}`);

		const { data: { installations } } = (await github.apps.listInstallationsForAuthenticatedUser());

		tracer.trace(`got user's installations from GitHub`);

		const installationsWithAdmin = await getInstallationsWithAdmin(installations, login, isAdmin);

		tracer.trace(`got user's installations with admin status from GitHub`);

		const { data: info } = (await client.apps.getAuthenticated());

		tracer.trace(`got user's authenticated apps from GitHub`);

		const connectedInstallations = await installationConnectedStatus(
			jiraHost,
			client,
			installationsWithAdmin,
			req.log
		);

		tracer.trace(`got connected installations`);

		res.render("github-configuration.hbs", {
			csrfToken: req.csrfToken(),
			installations: connectedInstallations,
			jiraHost: jiraHost,
			nonce: res.locals.nonce,
			info,
			clientKey: installation.clientKey,
			login
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
	admin: boolean;
}
