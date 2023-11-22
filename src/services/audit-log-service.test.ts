import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { dynamodb as ddb } from "config/dynamodb";
import { createHashWithoutSharedSecret } from "utils/encryption";
import { auditLog, findLog } from "./audit-log-service";

const logger = getLogger("test");
const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

describe("audit log service", () => {
	describe("auditLog", () => {
		it("should successfully save DD api call audit info to dynamo db", async () => {
			const createdAt = new Date();
			const subscriptionId = 241412;
			const entityId = "25e1008";
			const entityAction = "pushed";
			const entityType = "commit";
			const source = "backfill";
			const issueKey = "ARC-2605";
			const ID = `subID_${subscriptionId}_typ_${entityType}_id_${entityId}_issKey_${issueKey}`;
			await auditLog(
				{
					source,
					entityType,
					entityAction,
					entityId,
					subscriptionId,
					issueKey,
					createdAt
				},
				logger
			);
			const result = await ddb
				.getItem({
					TableName: envVars.DYNAMO_AUDIT_LOG_TABLE_NAME,
					Key: {
						Id: { S: createHashWithoutSharedSecret(ID) },
						CreatedAt: { N: String(createdAt.getTime()) }
					},
					AttributesToGet: [
						"Id",
						"CreatedAt",
						"ExpiredAfter",
						"source",
						"entityType",
						"entityAction",
						"entityId",
						"subscriptionId",
						"issueKey"
					]
				})
				.promise();
			expect(result.$response.error).toBeNull();
			expect(result.Item).toEqual({
				Id: { S: createHashWithoutSharedSecret(ID) },
				CreatedAt: { N: String(createdAt.getTime()) },
				ExpiredAfter: {
					N: String(
						Math.floor((createdAt.getTime() + ONE_DAY_IN_MILLISECONDS) / 1000)
					)
				},
				source: { S: source },
				entityAction: { S: entityAction },
				entityId: { S: entityId },
				entityType: { S: entityType },
				issueKey: { S: issueKey },
				subscriptionId: { N: String(subscriptionId) }
			});
		});

		describe("auditLog", () => {
			it("should successfully save DD api call audit info to dynamo db", async () => {
				const createdAt = new Date();
				const subscriptionId = 241412;
				const entityId = "25e1008";
				const entityAction = "pushed";
				const entityType = "commit";
				const source = "backfill";
				const issueKey = "ARC-2605";
				await auditLog(
					{
						source,
						entityType,
						entityAction,
						entityId,
						subscriptionId,
						issueKey,
						createdAt
					},
					logger
				);
				const result = await findLog(
					{
						entityType,
						entityId,
						subscriptionId,
						issueKey
					},
					logger
				);
				expect(result).toEqual([{
					entityAction,
					entityId,
					entityType,
					issueKey,
					source,
					subscriptionId,
					createdAt
				}]);
			});
		});
	});
});
