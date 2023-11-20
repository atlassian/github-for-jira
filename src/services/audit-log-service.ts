import Logger from "bunyan";
import { envVars } from "config/env";
import { getLogger } from "config/logger";
import { dynamodb as ddb } from "config/dynamodb";
import { createHashWithoutSharedSecret } from "utils/encryption";

const defaultLogger = getLogger("DeploymentDynamoLogger");
export type AuditInfoPK = {
	entityType: string;
	entityAction: string;
	entityId: string;
	subscriptionId: number;
	issueKey: string;
};

export type AuditInfo = {
	source: string;
	entityType: string;
	entityAction: string;
	entityId: string;
	subscriptionId: number;
	issueKey: string;
	env: string;
	createdAt: Date;
};

const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const auditLog = async (auditInfo : AuditInfo, logger: Logger) => {
	logger.debug("Saving auditInfo to db");
	const { source, entityAction, entityId, entityType, subscriptionId, env, issueKey, createdAt } = auditInfo;
	const result = await ddb.putItem({
		TableName: envVars.DYNAMO_AUDIT_LOG_TABLE_NAME,
		Item: {
			Id: { "S": getKey(auditInfo) }, //partition key
			CreatedAt: { "N": String(createdAt.getTime()) }, //sort key
			ExpiredAfter: { "N": String(Math.floor((new Date().getTime() + ONE_DAY_IN_MILLISECONDS) / 1000)) }, //ttl
			source: { "S": source },
			entityAction: { "S": entityAction },
			entityId: { "S": entityId },
			entityType: { "S": entityType },
			env: { "S": env },
			issueKey: { "S": issueKey },
			subscriptionId: { "N": String(subscriptionId) }
		}
	}).promise();
	if (result.$response.error) {
		throw result.$response.error;
	}
};

export type LastSuccessfulDeploymentFromCache = {
	commitSha: string;
	createdAt: Date;
};

export const findLog = async(
	params: AuditInfoPK,
	logger: Logger = defaultLogger
): Promise<LastSuccessfulDeploymentFromCache | undefined> => {
	logger.debug("Finding audit log for DD call");
	const result = await ddb.query({
		TableName: envVars.DYNAMO_AUDIT_LOG_TABLE_NAME,
		KeyConditionExpression: "Id = :id and CreatedAt < :createdAt",
		ExpressionAttributeValues: {
			":id": { "S": getKey(params) }
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
const getKey = (auditInfo: AuditInfoPK) => {
	const { entityAction, entityId, entityType, subscriptionId, issueKey } = auditInfo;
	return createHashWithoutSharedSecret(`subID_${subscriptionId}_typ_${entityType}_id_${entityId}_act_${entityAction}_issKey_${issueKey}`);
};
