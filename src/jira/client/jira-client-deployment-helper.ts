import { JiraDeploymentBulkSubmitData } from "interfaces/jira";
import { createHashWithSharedSecret } from "utils/encryption";
import Logger from "bunyan";

export const getDeploymentDebugInfo = (jiraPayload: JiraDeploymentBulkSubmitData | undefined): Record<string, number> => {

	if (!jiraPayload?.deployments?.length) return {};

	const deploymentData = jiraPayload.deployments[0];
	if (!deploymentData) return {};

	const associations = (deploymentData.associations || []);

	return {
		issueKeysCount: associations.filter(a => a.associationType === "issueKeys").map(a => a.values?.length || 0).reduce((a, b) => a + b, 0),
		issueIdOrKeysCount: associations.filter(a => a.associationType === "issueIdOrKeys").map(a => a.values?.length || 0).reduce((a, b) => a + b, 0),
		serviceIdOrKeysCount: associations.filter(a => a.associationType === "serviceIdOrKeys").map(a => a.values?.length || 0).reduce((a, b) => a + b, 0),
		commitCount: associations.filter(a => a.associationType === "commit").map(a => a.values?.length || 0).reduce((a, b) => a + b, 0)
	};
};

export const extractDeploymentDataForLoggingPurpose = (data: JiraDeploymentBulkSubmitData, logger: Logger): Record<string, any> => {
	try {
		return {
			deployments: (data.deployments || []).map(deployment => ({
				updateSequenceNumber: deployment.updateSequenceNumber,
				state: createHashWithSharedSecret(deployment.state),
				url: createHashWithSharedSecret(deployment.url),
				issueKeys: (deployment.associations || [])
					.filter(a => ["issueKeys", "issueIdOrKeys", "serviceIdOrKeys"].includes(a.associationType))
					.flatMap(a => (a.values as string[] || []).map((v: string) => createHashWithSharedSecret(v)))
			}))
		};
	} catch (error) {
		logger.error({ error }, "Fail extractDeploymentDataForLoggingPurpose");
		return {};
	}
};
