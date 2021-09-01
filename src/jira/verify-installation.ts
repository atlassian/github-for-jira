import * as Sentry from "@sentry/node";
import getAxiosInstance from "./client/axios";
import Installation from "../models/installation";
import Logger from "bunyan";

export default (installation: Installation, log: Logger) => {
	return async (): Promise<void> => {
		const instance = getAxiosInstance(installation.jiraHost, installation.sharedSecret, log);

		try {
			const result = await instance.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1");
			if (result.status === 200) {
				log.info(`Installation id=${installation.id} enabled on Jira`);
				await installation.enable();
			} else {
				const message = `Unable to verify Jira installation: ${installation.jiraHost} responded with ${result.status}`;
				log.warn(message);
				Sentry.captureMessage(message);
			}
		} catch (err) {
			if (err.response?.status === 401) {
				log.warn({...err}, "Jira does not recognize installation. Deleting it");
				await installation.destroy();
			} else {
				log.error({...err}, "Unhandled error while verifying installation");
				Sentry.captureException(err);
			}
		}
	};
};
