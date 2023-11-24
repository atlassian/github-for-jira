import { Subscription } from "models/subscription";
import { saveConfiguredAppProperties } from "utils/app-properties-utils";

/**
 * This endpoint is used by the Pollinator tests for checking the config state endpoint when subscriptions are deleted.
 *
 * This avoids all the token checks,
 * Removes the Dummy Subscription whose installationId is `12345`
 * Updates the config state to false.
 *
 * @param req
 * @param res
 * @constructor
 */
export const ApiDummySubscriptionDelete = async (req, res) => {
	const jiraHost = req.params.jiraHost as string;

	try {
		// Deleting the Dummy Subscription whose installation id is `12345`
		const subscription = await Subscription.findOneForGitHubInstallationId(12345, undefined);
		await subscription?.destroy();

		// Set the config state to false
		await saveConfiguredAppProperties(jiraHost, req.log, false);
		res.status(200).send({ message: "Dummy subscription deleted & config state set to false!" });
	} catch (err) {
		req.log.info({ err }, "Failed to delete the dummy subscription");
	}
};
