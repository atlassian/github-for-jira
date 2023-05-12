import AWS from "aws-sdk";
import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { saveDeploymentInfo } from "./deployment-service";

const logger = getLogger("test");
const ddb = new AWS.DynamoDB({
	apiVersion: "2012-11-05",
	region: envVars.DYNAMO_REGION,
	endpoint: "http://localhost:4566"
});

describe("Deployment status service", () => {
	describe("saveDeploymentInfo", () => {
		it("should successfully save deployment info to dynamo db", async () => {

			const createdAt = new Date();

			await saveDeploymentInfo({
				gitHubInstallationId: 1,
				gitHubAppId: 2,
				repositoryId: 3,
				commitSha: "abc-abc-abc",
				description: "some-random description",
				originEnv: "production",
				mappedEnv: "production",
				status: "success",
				createdAt
			}, logger);

			const result = await ddb.getItem({
				TableName: envVars.DYNAMO_TABLE_DEPLOYMENT,
				Key: {
					"Id": { "S": `ghid_1_ghappid_2_repo_3_env_production` },
					"StatusCreatedAt": { "N": String(createdAt.getTime()) }
				},
				AttributesToGet: [
					"Id", "StatusCreatedAt",
					"GitHubInstallationId", "GitHubAppId", "RepositoryId",
					"CommitSha", "Description",
					"OriginEnv", "MappedEnv", "Status"
				]
			}).promise();

			expect(result.$response.error).toBeNull();
			expect(result.Item).toEqual({
				Id: { "S": "ghid_1_ghappid_2_repo_3_env_production" },
				StatusCreatedAt: { "N": String(createdAt.getTime()) },
				GitHubInstallationId: { "N": "1" },
				GitHubAppId: { "N": "2" },
				RepositoryId: { "N": "3" },
				CommitSha: { "S": "abc-abc-abc" },
				Description: { "S": "some-random description" },
				OriginEnv: { "S": "production" },
				MappedEnv: { "S": "production" },
				Status: { "S": "success" }
			});
		});
	});
});
