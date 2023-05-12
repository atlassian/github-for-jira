import Logger from "bunyan";

type DeploymentInfo = {
	gitHubInstallationId: number;
	gitHubAppId: number | undefined;
	repositoryId: number;
	commitSha: string;
	description: string;
	originEnv: string;
	mappedEnv: string;
	status: "pending" | "success" | "failure" | "error"
}

export const saveDeploymentInfo = async (deploymentInfo :DeploymentInfo, logger: Logger) => {
	logger.info('===============', {deploymentInfo});
};
