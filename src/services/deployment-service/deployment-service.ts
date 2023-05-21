import Logger from "bunyan";
import { envVars } from "config/env";
import { getLogger } from "config/logger";
import { dynamodb as ddb } from "models/dynamodb";
import { hash } from "utils/hash-utils";

const defaultLogger = getLogger("DeploymentDynamoLogger");

const ONE_YEAR_IN_MILLISECONDS = 365 * 24 * 60 * 60 * 1000;

export const saveDeploymentInfo = async (deploymentInfo : {
	gitHubBaseUrl: string
	repositoryId: number;
	commitSha: string;
	env: string;
	createdAt: Date;
}, logger: Logger) => {
	logger.debug("Saving deploymentInfo to db");
	const result = await ddb.putItem({
		TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME,
		Item: {
			Id: { "S": getKey(deploymentInfo) }, //partition key
			CreatedAt: { "N": String(deploymentInfo.createdAt.getTime()) }, //sort key
			CommitSha: { "S": deploymentInfo.commitSha }, //real data we need
			ExpiredAfter: { "N": String(Math.floor((deploymentInfo.createdAt.getTime() + ONE_YEAR_IN_MILLISECONDS) / 1000)) } //ttl
		}
	}).promise();
	if (result.$response.error) {
		throw result.$response.error;
	}
};

export type LastSuccessfulDeployment = {
	commitSha: string;
	createdAt: Date;
}

export const findLastSuccessDeployment = async(
	params: {
		gitHubBaseUrl: string;
		repositoryId: number;
		env: string;
		currentDate: Date;
	},
	logger: Logger = defaultLogger
): Promise<LastSuccessfulDeployment | undefined> => {
	logger.debug("Finding last successful deploymet");
	const result = await ddb.query({
		TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME,
		KeyConditionExpression: "Id = :id and CreatedAt < :createdAt",
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
		commitSha: item.CommitSha.S || "",
		createdAt: new Date(Number(item.CreatedAt.N))
	};
};

/*
 * The partition key (return of this function) + range key (creation time of the deployment status) will be the unique identifier of the each entry
 * Some assumption here is repositoryId is unique per github base url (cloud and ghes) per env.
 * So if multiple jiraHost connect to the same app (like same cloud org but multiple subscription), the data will be shared.
 * Sharing that deployment data is okay, because they base on the github deployment result, not our subscription.
 */
const getKey = (opts: {
	gitHubBaseUrl: string;
	repositoryId: number;
	env: string;
}) => {
	return hash(`ghurl_${opts.gitHubBaseUrl}_repo_${opts.repositoryId}_env_${opts.env}`);
};
