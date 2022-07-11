import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";
import { InstallationId } from "~/src/github/client/installation-id";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { Subscription } from "~/src/models/subscription";
import * as PrivateKey from "probot/lib/private-key";

/**
 * Look for a Github app's private key
 */
export const defaultKeyLocator = async (gitHubInstallation: InstallationId) => {
	const subscription = await Subscription.findOneForGitHubInstallationId(gitHubInstallation.installationId);
	if (await booleanFlag(BooleanFlags.GHE_SERVER, false, subscription?.jiraHost)) {
		const gitHubServerApp = subscription?.gitHubAppId && await GitHubServerApp.getForGitHubServerAppId(subscription?.gitHubAppId);
		if (gitHubServerApp) {
			return await gitHubServerApp.decrypt("privateKey");
		}
		// No github app found, fetch cloud private key from env. variable
		return process.env.PRIVATE_KEY || "";

	} else {
		return PrivateKey.findPrivateKey() || "";
	}
};
