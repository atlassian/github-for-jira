import AWS from "aws-sdk";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { saveDeploymentInfo } from "./deployment-service";

const logger = getLogger("test");
const ddb = new AWS.DynamoDB({ apiVersion: "2012-08-10" });

describe("Deployment status service", () => {
	describe("saveDeploymentInfo", () => {
		it("should successfully save deployment info to dynamo db", async () => {

			await saveDeploymentInfo({
				gitHubInstallationId: 1,
				gitHubAppId: 2,
				repositoryId: 3,
				commitSha: "abc-abc-abc",
				description: "some-random description",
				originEnv: "production",
				mappedEnv: "production",
				status: "success"
			}, logger);

			const result = await ddb.getItem({
				TableName: envVars.DYNAMO_TABLE_DEPLOYMENT,
				Key: {
					"Id": { "S": "1" }
				},
				AttributesToGet: ["Id", "StatusCreatedAt", "OriginEnv", "MappedEnv", "CommitSha"]
			}).promise();

			expect(result.$response.error).toBeUndefined();
		});
	});
});
