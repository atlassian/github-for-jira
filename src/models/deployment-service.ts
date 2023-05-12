import Logger from "bunyan";
import AWS from "aws-sdk";
import { envVars } from "config/env";

type DeploymentInfo = {
	gitHubInstallationId: number;
	gitHubAppId: number | undefined;
	repositoryId: number;
	commitSha: string;
	description: string;
	originEnv: string;
	mappedEnv: string;
	status: "pending" | "success" | "failure" | "error";
	createdAt: Date;
}

const ddb = new AWS.DynamoDB({
	apiVersion: "2012-11-05",
	region: envVars.DYNAMO_REGION,
	endpoint: "http://localhost:4566"
});

export const saveDeploymentInfo = async (deploymentInfo :DeploymentInfo, logger: Logger) => {
	logger.debug("Saving deploymentInfo to db");
	const result = await ddb.putItem({
		TableName: envVars.DYNAMO_TABLE_DEPLOYMENT,
		Item: {
			Id: { "S": getKey(deploymentInfo) },
			StatusCreatedAt: { "N": String(deploymentInfo.createdAt.getTime()) },
			GitHubInstallationId: { "N": String(deploymentInfo.gitHubInstallationId) },
			GitHubAppId: { "N": String(deploymentInfo.gitHubAppId) },
			RepositoryId: { "N": String(deploymentInfo.repositoryId) },
			CommitSha: { "S": deploymentInfo.commitSha },
			Description: { "S": deploymentInfo.description },
			OriginEnv: { "S": deploymentInfo.originEnv },
			MappedEnv: { "S": deploymentInfo.mappedEnv },
			Status: { "S": deploymentInfo.status }
		}
	}).promise();
	if (result.$response.error) {
		throw result.$response.error;
	}
};

export const getKey = ({ gitHubInstallationId, gitHubAppId, repositoryId, originEnv }: DeploymentInfo) => {
	return `ghid_${gitHubInstallationId}_ghappid_${gitHubAppId}_repo_${repositoryId}_env_${originEnv}`;
};
