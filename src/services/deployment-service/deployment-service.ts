import Logger from "bunyan";
import { envVars } from "config/env";
import { getLogger } from "config/logger";
import { dynamodb as ddb } from "models/dynamodb";
import { hash } from "utils/hash-utils";

const defaultLogger = getLogger("DeploymentDynamoLogger");

const ONE_YEAR_IN_MILLISECONDS = 365 * 24 * 60 * 60 * 1000;

export const saveDeploymentInfo = async (deploymentInfo : {
	gitHubBaseUrl: string
	gitHubInstallationId: number;
	repositoryId: number;
	commitSha: string;
	env: string;
	status: string;
	createdAt: Date;
}, logger: Logger) => {
	logger.debug("Saving deploymentInfo to db");
	const result = await ddb.putItem({
		TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_TABLE_NAME,
		Item: {
			GitHubRepoEnvKey: { "S": getKey(deploymentInfo) },
			StatusCreatedAt: { "N": String(deploymentInfo.createdAt.getTime()) },
			GitHubInstallationId: { "N": String(deploymentInfo.gitHubInstallationId) },
			RepositoryId: { "N": String(deploymentInfo.repositoryId) },
			CommitSha: { "S": deploymentInfo.commitSha },
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
		repositoryId: number;
		env: string;
		currentDate: Date;
	},
	logger: Logger = defaultLogger
): Promise<LastSuccessfulDeployment | undefined> => {
	logger.debug("Finding last successful deploymet");
	const result = await ddb.query({
		TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_TABLE_NAME,
		KeyConditionExpression: "GitHubRepoEnvKey = :gitHubRepoEnvKey and StatusCreatedAt < :createdAt",
		ExpressionAttributeValues: {
			":gitHubRepoEnvKey": { "S": getKey(params) },
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

/*
 * The partition key (return of this function) + range key (creation time of the deployment status) will be the unique identifier of the each entry
 * Some assumption here is the gitHubInstallationId and repositoryId, each of them is unique per github base url (cloud and ghes) per repo per env.
 * So if multiple jiraHost connect to the same app (like same cloud org but multiple subscription), the data will be shared.
 * Sharing that deployment data is okay, because they base on the github deployment result, not our subscription.
 * -- future, I guess we can even share data across installation, coz deployment status data is per repo, regardless of which app installation it comes from.
 * But this only benefit multi app within GHES, so can relax for now.
 */
const getKey = (opts: {
	gitHubBaseUrl: string;
	repositoryId: number;
	env: string;
}) => {
	return hash(`ghurl_${opts.gitHubBaseUrl}_repo_${opts.repositoryId}_env_${opts.env}`);
};
