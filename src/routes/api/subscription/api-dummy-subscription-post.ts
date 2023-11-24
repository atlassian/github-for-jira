import { Subscription } from "models/subscription";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";

/**
 * This endpoint is a copy of the github-configuration-post.
 * This is used by the Pollinator tests for checking the config state endpoint.
 *
 * This avoids all the token checks,
 * Adds a Dummy Subscription whose installationId is `12345`
 * Updates the config state to true.
 *
 * @param req
 * @param res
 * @constructor
 */
export const ApiDummySubscriptionPost = async (req, res) => {
	const jiraHost = req.params.jiraHost as string;

	try {
		// Create a dummy Subscription
		await Subscription.install({
			hashedClientKey: "dummy-hashed-client-key",
			installationId: 12345, // Dummy installation id
			host: jiraHost,
			gitHubAppId: undefined
		});

		// Set the config state to true
		await saveConfiguredAppProperties(jiraHost, req.log, true);
		res.status(200).send({ message: "Dummy subscription created & config state set to true!" });
	} catch (err) {
		req.log.info({ err }, "Failed to set jiraHosts configurations");
	}
};
