import Logger from "bunyan";
import { envVars } from "config/env";
import { getLogger } from "config/logger";
import { dynamodb as ddb } from "models/dynamodb";

const defaultLogger = getLogger("DeploymentDynamoLogger");

const ONE_YEAR_IN_MILLISECONDS = 365 * 24 * 60 * 60 * 1000;

export const saveDeploymentInfo = async (deploymentInfo : {
	gitHubBaseUrl: string
	gitHubInstallationId: number;
	repositoryId: number;
	commitSha: string;
	description: string;
	env: string;
	status: string;
	createdAt: Date;
}, logger: Logger) => {
	logger.debug("Saving deploymentInfo to db");
	const result = await ddb.putItem({
		TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_TABLE_NAME,
		Item: {
			Id: { "S": getKey(deploymentInfo) },
			StatusCreatedAt: { "N": String(deploymentInfo.createdAt.getTime()) },
			GitHubInstallationId: { "N": String(deploymentInfo.gitHubInstallationId) },
			RepositoryId: { "N": String(deploymentInfo.repositoryId) },
			CommitSha: { "S": deploymentInfo.commitSha },
			Description: { "S": deploymentInfo.description },
			Env: { "S": deploymentInfo.env },
			Status: { "S": deploymentInfo.status },
			ExpiredAfter: { "N": String(Math.floor((deploymentInfo.createdAt.getTime() + ONE_YEAR_IN_MILLISECONDS) / 1000)) }
		}
	}).promise();
	if (result.$response.error) {
		throw result.$response.error;
	}
};

export type LastSuccessfulDeployment = {
	repositoryId: number;
	commitSha: string;
	createdAt: Date;
}

export const findLastSuccessDeployment = async(
	params: {
		gitHubBaseUrl: string;
		gitHubInstallationId: number;
		repositoryId: number;
		env: string;
		currentDate: Date;
	},
	logger: Logger = defaultLogger
): Promise<LastSuccessfulDeployment | undefined> => {
	logger.debug("Finding last successful deploymet");
	const result = await ddb.query({
		TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_TABLE_NAME,
		KeyConditionExpression: "Id = :id and StatusCreatedAt < :createdAt",
		ExpressionAttributeValues: {
			":id": { "S": getKey(params) },
			":createdAt": { "N": String(params.currentDate.getTime()) }
		},
		ScanIndexForward: false,
		Limit: 1
	}).promise();

	if (result.$response.error) {
		throw result.$response.error;
	}

	if (!result.Items?.length) {
		return undefined;
	}

	const item = result.Items[0];

	return {
		repositoryId: Number(item.RepositoryId.N),
		commitSha: item.CommitSha.S || "",
		createdAt: new Date(Number(item.StatusCreatedAt.N))
	};
};

const getKey = (opts: {
	gitHubBaseUrl: string;
	gitHubInstallationId: number;
	repositoryId: number;
	env: string;
}) => {
	return `ghurl_${opts.gitHubBaseUrl}_ghid_${opts.gitHubInstallationId}_repo_${opts.repositoryId}_env_${opts.env}`;
};
