import { getLogger } from "config/logger";
import { envVars } from "config/env";
// import { cacheSuccessfulDeploymentInfo, findLastSuccessDeploymentFromCache } from "./deployment-cache-service";
import { dynamodb as ddb } from "config/dynamodb";
import { createHashWithoutSharedSecret } from "utils/encryption";
import { auditLog } from "./audit-log-service";

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
			const env = "prod";
			const ID = `subID_${subscriptionId}_type_${entityType}_id_${entityId}_action_${entityAction}_issueKey_${issueKey}`;
			await auditLog(
				{
					source,
					entityType,
					entityAction,
					entityId,
					subscriptionId,
					issueKey,
					env,
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
						"issueKey",
						"env"
					]
				})
				.promise();
			expect(result.$response.error).toBeNull();
			expect(result.Item).toEqual({
				Id: { "S": createHashWithoutSharedSecret(ID) },
				CreatedAt: { "N": String(createdAt.getTime()) },
				ExpiredAfter: { "N": String(Math.floor((createdAt.getTime() + ONE_DAY_IN_MILLISECONDS) / 1000)) },
				source: { "S": source },
				entityAction: { "S": entityAction },
				entityId: { "S": entityId },
				entityType: { "S": entityType },
				env: { "S": env },
				issueKey: { "S": issueKey },
				subscriptionId: { "N": String(subscriptionId) }
			});
		});
	});
});
