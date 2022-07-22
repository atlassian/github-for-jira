import * as Sentry from "@sentry/node";
import { getAxiosInstance } from "./client/axios";
import { Installation } from "models/installation";
import Logger from "bunyan";
import { BooleanFlags, booleanFlag } from "config/feature-flags";

export const verifyJiraInstallation = (installation: Installation, log: Logger) => {
	return async (): Promise<boolean> => {
		const instance = getAxiosInstance(
			installation.jiraHost,
			await booleanFlag(BooleanFlags.READ_SHARED_SECRET_FROM_CRYPTOR, false, installation.jiraHost)
				? await installation.decrypt("encryptedSharedSecret")
				: installation.sharedSecret,
			log
		);
		try {
			const result = await instance.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1");
			if (result.status === 200) {
				log.info(`Installation id=${installation.id} enabled on Jira`);
				return true;
			} else {
				const message = `Unable to verify Jira installation: ${installation.jiraHost} responded with ${result.status}`;
				log.warn(message);
				Sentry.captureMessage(message);
				return false;
			}
		} catch (err) {
			if (err.response?.status === 401) {
				log.warn(err, "Jira does not recognize installation. Deleting it");
				await installation.destroy();
			} else {
				log.error(err, "Unhandled error while verifying installation");
				Sentry.captureException(err);
			}
			return false;
		}
	};
};
