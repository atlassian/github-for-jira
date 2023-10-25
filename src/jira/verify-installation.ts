import * as Sentry from "@sentry/node";
import { getAxiosInstance } from "./client/axios";
import { Installation } from "models/installation";
import Logger from "bunyan";

export const verifyJiraInstallation = (installation: Installation, log: Logger) => {
	return async (): Promise<boolean> => {
		const instance = getAxiosInstance(
			installation.jiraHost,
			await installation.decrypt("encryptedSharedSecret", log),
			log
		);
		try {
			const result = await instance.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1");
			if (result.status === 200) {
				log.info(`Installation id=${installation.id} enabled on Jira`);
				return true;
			} else {
				const message = `Unable to verify Jira installation: responded with ${result.status}`;
				log.warn({ jiraHost: installation.jiraHost }, message);
				Sentry.captureMessage(message);
				return false;
			}
		} catch (e: unknown) {
			const err = e as { response?: { status?: number } };
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
