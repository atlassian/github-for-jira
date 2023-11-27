import Logger from "bunyan";
import { envVars } from "config/env";
import { getLogger } from "config/logger";
import { dynamodb as ddb } from "config/dynamodb";

const defaultLogger = getLogger("DeploymentDynamoLogger");

export type AuditLogSourceType = "BACKFILL" | "WEBHOOK";
type AuditEntityTypePR = "PR_OPENED" | "PR_REOPENED" | "PR_CLOSED" | "PR_EDITED" | "PR_READY_FOR_REVIEW" | "PR_CONVERTED_TO_DRAFT" | "PR_REVIEW";
type AuditEntityTypeCommit = "COMMIT_PUSH";
type AuditEntityTypeBranch = "BRANCH_CREATE" | "BRANCH_DELETE";
type AuditEntityTypeBuild = "WORKFLOW_RUN";
export type AuditEntityType = AuditEntityTypePR | AuditEntityTypeBranch | AuditEntityTypeCommit | AuditEntityTypeBuild;

export type AuditInfoPK = {
	entityType: string;
	entityId: string;
	subscriptionId: number;
	issueKey: string;
};

export type AuditInfo = AuditInfoPK & {
	createdAt: Date;
	entityAction: string;
	source: string;
};

const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

export const saveAuditLog = async (auditInfo: AuditInfo, logger: Logger) => {
	logger.debug("Saving auditInfo to db");
	const {
		source,
		entityAction,
		entityId,
		entityType,
		subscriptionId,
		issueKey,
		createdAt
	} = auditInfo;
	const result = await ddb
		.putItem({
			TableName: envVars.DYNAMO_AUDIT_LOG_TABLE_NAME,
			Item: {
				Id: { S: getKey(auditInfo) }, //partition key
				CreatedAt: { N: String(createdAt.getTime()) }, //sort key
				ExpiredAfter: {
					N: String(
						Math.floor(
							(auditInfo.createdAt.getTime() + ONE_DAY_IN_MILLISECONDS) / 1000
						)
					)
				}, //ttl
				source: { S: source },
				entityAction: { S: entityAction },
				entityId: { S: entityId },
				entityType: { S: entityType },
				issueKey: { S: issueKey },
				subscriptionId: { N: String(subscriptionId) }
			}
		})
		.promise();
	if (result.$response.error) {
		throw result.$response.error;
	}
};

export const getAuditLog = async (
	params: AuditInfoPK,
	logger: Logger = defaultLogger
): Promise<AuditInfo[]> => {
	logger.debug("Finding audit log for DD call");
	const result = await ddb
		.query({
			TableName: envVars.DYNAMO_AUDIT_LOG_TABLE_NAME,
			KeyConditionExpression: "Id = :id",
			ExpressionAttributeValues: {
				":id": { S: getKey(params) }
			},
			ScanIndexForward: false,
			Limit: 1
		})
		.promise();

	if (result.$response.error) {
		throw result.$response.error;
	}

	if (!result.Items?.length) {
		return [];
	}

	const items = result.Items;

	return items.map((item) => ({
		source: String(item.source.S),
		entityType: String(item.entityType.S),
		entityAction: String(item.entityAction.S),
		entityId: String(item.entityId.S),
		subscriptionId: Number(item.subscriptionId.N),
		issueKey: String(item.issueKey.S),
		createdAt: new Date(Number(item.CreatedAt.N))
	}));
};

/*
 * The partition key (return of this function) + range key (creation time of the deployment status) will be the unique identifier of the each entry
 */
const getKey = (auditInfo: AuditInfoPK) => {
	const { entityId, entityType, subscriptionId, issueKey } = auditInfo;
	return `subID_${subscriptionId}_typ_${entityType}_id_${entityId}_issKey_${issueKey}`;
};
