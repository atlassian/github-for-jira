import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { dynamodb as ddb } from "config/dynamodb";
import { saveAuditLog, getAuditLog } from "./audit-log-service";

const logger = getLogger("test");
const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;

describe("audit log service", () => {
	describe("saveAuditLog", () => {
		it("should successfully save DD api call audit info to dynamo db", async () => {
			const createdAt = new Date();
			const subscriptionId = 241412;
			const entityId = "25e1008";
			const entityAction = "pushed";
			const entityType = "commit";
			const source = "backfill";
			const issueKey = "ARC-2605";
			const ID = `subID_${subscriptionId}_typ_${entityType}_id_${entityId}_issKey_${issueKey}`;
			await saveAuditLog(
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
						Id: { S: ID },
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
				Id: { S: ID },
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

		describe("saveAuditLog", () => {
			it("should successfully save DD api call audit info to dynamo db", async () => {
				const createdAt = new Date();
				const subscriptionId = 241412;
				const entityId = "25e1008";
				const entityAction = "pushed";
				const entityType = "commit";
				const source = "backfill";
				const issueKey = "ARC-2605";
				await saveAuditLog(
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
				const result = await getAuditLog(
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

		describe("getAuditLog", () => {
			const saveLog = async (subscriptionId: number, entityId: string) => {
				const createdAt = new Date();
				await saveAuditLog({
					subscriptionId,
					source: "WEBHOOK",
					entityType: "commits",
					entityAction: "push",
					entityId,
					issueKey: "ABC-123",
					createdAt
				}, getLogger("test"));
				return { createdAt };
			};

			it("should successfully fetch saved audit info to dynamo db by order of createdAt desc", async () => {

				const subId1 = 123;
				const subId2 = 456;
				const { createdAt: createdAtEarlier } = await saveLog(subId1, "commit-123");
				await saveLog(subId2, "commit-456");
				const { createdAt: createdAtLater } = await saveLog(subId1, "commit-123");
				await saveLog(subId1, "commit-789");

				const result = await getAuditLog({ entityType: "commits", entityId: "commit-123", subscriptionId: subId1, issueKey: "ABC-123" }, logger);

				expect(result).toEqual([
					expect.objectContaining({
						entityId: "commit-123",
						issueKey: "ABC-123",
						subscriptionId: subId1,
						createdAt: createdAtLater
					}),
					expect.objectContaining({
						entityId: "commit-123",
						issueKey: "ABC-123",
						subscriptionId: subId1,
						createdAt: createdAtEarlier
					})
				]);
			});

			it("should successfully fetch saved audit info to dynamo db up to 100 items", async () => {

				for (let i=0; i < 100; i++) {
					await saveLog(1234, "commit-1234");
				}

				const result = await getAuditLog({ entityType: "commits", entityId: "commit-1234", subscriptionId: 1234, issueKey: "ABC-123" }, logger);

				expect(result.length).toBe(100);
				result.forEach(r => expect(r).toEqual(expect.objectContaining({
					entityId: "commit-1234",
					issueKey: "ABC-123",
					subscriptionId: 1234
				})));

			});
		});
	});
});
