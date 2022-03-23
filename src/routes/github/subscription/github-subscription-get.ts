import { Subscription } from "../../../models";
import { NextFunction, Request, Response } from "express";
import { getCloudInstallationId } from "../../../github/client/installation-id";
import { GitHubAppClient } from "../../../github/client/github-app-client";
import { GitHubUserClient } from "../../../github/client/github-user-client";
// import { booleanFlag, BooleanFlags } from "../../../config/feature-flags";


export const GithubSubscriptionGet = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
	const { github, client, isAdmin, githubToken, jiraHost } = res.locals; // TEST mock res.locals

	if (!githubToken) { // TEST 1 - no githubtoken throw error
		return next(new Error("Unauthorized"));
	}

	const gitHubInstallationId = Number(req.params.installationId); // TEST mock req.body
	const logger = req.log.child({ jiraHost, gitHubInstallationId });  // TEST mock
	const useNewGitHubClient = false;// await booleanFlag(BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_GET_SUBSCRIPTION, false, jiraHost) ; // TEST mock
	const gitHubAppClient = new GitHubAppClient(getCloudInstallationId(gitHubInstallationId), logger); // TEST mock
	const gitHubUserClient = new GitHubUserClient(githubToken, logger); // TEST mock

	try {
		const { data: login } = useNewGitHubClient ? await gitHubUserClient.getUser() : await github.users.getAuthenticated(); // TEST
		console.log("IM HERE ZZZZZZ");
		console.log(login);
		console.log("IM HERE 222222");
		console.log((await github.users.getAuthenticated()));
		// get the installation to see if the user is an admin of it
		const { data: installation } = useNewGitHubClient ? // describe each on this...sigh
			await gitHubAppClient.getInstallation(gitHubInstallationId) : // TEST - nock
			await client.apps.getInstallation({ installation_id: gitHubInstallationId }); //  // TEST nock

		// get all subscriptions from the database for this installation ID
		const subscriptions = await Subscription.getAllForInstallation(gitHubInstallationId);  // TEST - berfore each create sub
		
		// Only show the page if the logged in user is an admin of this installation
		if (await isAdmin({ // TEST mock isAdmin to resolve with boolean
			org: installation.account.login,
			username: login,
			type: installation.target_type
		})) {
			const { data: info } = useNewGitHubClient ? await gitHubAppClient.getInstallations() : await client.apps.getAuthenticated(); // TEST nock
			return res.render("github-subscriptions.hbs", {  // TEST 3 - was called with .....
				csrfToken: req.csrfToken(),
				nonce: res.locals.nonce,
				installation,
				info,
				host: res.locals.jiraHost,
				subscriptions,
				hasSubscriptions: subscriptions.length > 0
			});
		} else {
			return next(new Error("Unauthorized"));  // TEST 2 - throw error if not admin
		}
	} catch (err) {
		req.log.error(err, "Unable to show subscription page"); // TEST 4 - throw error on res.render or getInstallations/getAuthenticated 
		return next(new Error("Not Found"));
	}
};
