import { JiraDeploymentBulkSubmitData } from "interfaces/jira";

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
