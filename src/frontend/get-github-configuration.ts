import { Installation, Subscription } from "../models";
import { NextFunction, Request, Response } from "express";
import enhanceOctokit from "../config/enhance-octokit";
import app from "../worker/app";
import { getInstallation } from "./get-jira-configuration";
import { decodeSymmetric, getAlgorithm } from "atlassian-jwt";
import { GitHubAPI } from "probot";
import { Octokit } from "@octokit/rest";
import { booleanFlag, BooleanFlags } from '../config/feature-flags';

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

export default async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	if (!req.session.githubToken) {
		return next(new Error("Github Auth token is missing"));
	}

	if (!req.session.jiraHost) {
		return next(new Error("Jira Host url is missing"));
	}

	req.log.info({ installationId: req.body.installationId }, "Received delete jira configuration request");

	const github: GitHubAPI = res.locals.github;
	const client: GitHubAPI = res.locals.client;
	const isAdmin: (args: { org: string, username: string, type: string }) => Promise<boolean> = res.locals.isAdmin;

	async function getInstallationsWithAdmin({ installations, login }) {
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

			installation.numberOfRepos = numberOfRepos.length || 0;
			installationsWithAdmin.push({ ...installation, admin });
		}
		return installationsWithAdmin;
	}

	const { jiraHost, jwt } = req.session;

	if (jwt && jiraHost) {
		const { data: { login } } = await github.users.getAuthenticated();

		try {
			// we can get the jira client Key from the JWT's `iss` property
			// so we'll decode the JWT here and verify it's the right key before continuing
			const installation = await Installation.getForHost(jiraHost);
			if (!installation) {
				req.log.warn({ req, res }, "Missing installation");
				res.status(404).send(`Missing installation for host '${jiraHost}'`);
				return;
			}
			const { iss: clientKey } = decodeSymmetric(jwt, installation.sharedSecret, getAlgorithm(jwt));

			const { data: { installations } } = (await github.apps.listInstallationsForAuthenticatedUser());
			const installationsWithAdmin = await getInstallationsWithAdmin({ installations, login });
			const { data: info } = (await client.apps.getAuthenticated());
			const connectedInstallations = await installationConnectedStatus(
				jiraHost,
				client,
				installationsWithAdmin,
				req.log
			);

			const newConnectAnOrgPgFlagIsOn = await booleanFlag(BooleanFlags.NEW_CONNECT_AN_ORG_PAGE, true, jiraHost);
			const connectAnOrgPageVersion = newConnectAnOrgPgFlagIsOn ? "github-configuration.hbs" : "github-configuration-OLD.hbs";

			res.render(connectAnOrgPageVersion, {
				csrfToken: req.csrfToken(),
				installations: connectedInstallations,
				jiraHost: jiraHost,
				nonce: res.locals.nonce,
				info,
				clientKey,
				login
			});
		} catch (err) {
			// If we get here, there was either a problem decoding the JWT
			// or getting the data we need from GitHub, so we'll show the user an error.
			req.log.error({ err, req, res }, "Error while getting github configuration page");
			return next(err);
		}
	}
};

interface InstallationWithAdmin extends Octokit.AppsListInstallationsForAuthenticatedUserResponseInstallationsItem {
	admin: boolean;
}
