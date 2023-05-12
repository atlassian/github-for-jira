import Logger from "bunyan";
import AWS from "aws-sdk";
import { envVars } from "config/env";
import { getLogger } from "config/logger";

const defaultLogger = getLogger("DeploymentDynamoLogger");

const ddb = new AWS.DynamoDB({
	apiVersion: "2012-11-05",
	region: envVars.DYNAMO_REGION,
	endpoint: "http://localhost:4566"
});

type DeploymentInfo = {
	gitHubInstallationId: number;
	repositoryId: number;
	commitSha: string;
	description: string;
	env: string;
	status: "pending" | "success" | "failure" | "error";
	createdAt: Date;
}

export const saveDeploymentInfo = async (deploymentInfo :DeploymentInfo, logger: Logger) => {
	logger.debug("Saving deploymentInfo to db");
	const result = await ddb.putItem({
		TableName: envVars.DYNAMO_TABLE_DEPLOYMENT,
		Item: {
			Id: { "S": getKey(deploymentInfo) },
			StatusCreatedAt: { "N": String(deploymentInfo.createdAt.getTime()) },
			GitHubInstallationId: { "N": String(deploymentInfo.gitHubInstallationId) },
			RepositoryId: { "N": String(deploymentInfo.repositoryId) },
			CommitSha: { "S": deploymentInfo.commitSha },
			Description: { "S": deploymentInfo.description },
			Env: { "S": deploymentInfo.env },
			Status: { "S": deploymentInfo.status }
		}
	}).promise();
	if (result.$response.error) {
		throw result.$response.error;
	}
};

type FindLastSuccessDeploymentQueryParam = {
	gitHubInstallationId: number;
	repositoryId: number;
	env: string;
	currentDate: Date
};
type FindLastSuccessDeploymentQueryResult = {
	repositoryId: number,
	commitSha: string,
	createdAt: Date
};

export const findLastSuccessDeployment = async(
	params: FindLastSuccessDeploymentQueryParam,
	logger: Logger = defaultLogger
): Promise<FindLastSuccessDeploymentQueryResult | undefined> => {
	logger.debug("Finding last successful deploymet");
	const result = await ddb.query({
		TableName: envVars.DYNAMO_TABLE_DEPLOYMENT,
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

export const getKey = (opts: {
	gitHubInstallationId: number,
	repositoryId: number,
	env: string
}) => {
	return `ghid_${opts.gitHubInstallationId}_repo_${opts.repositoryId}_env_${opts.env}`;
};
