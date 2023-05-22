import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { cacheSuccessfulDeploymentInfo, findLastSuccessDeploymentFromCache } from "./deployment-cache-service";
import { dynamodb as ddb } from "config/dynamodb";
import { createHashWithoutSharedSecret } from "utils/encryption";

const logger = getLogger("test");
const ONE_YEAR_IN_MILLISECONDS = 365 * 24 * 60 * 60 * 1000;

describe("Deployment status service", () => {

	describe("cacheSuccessfulDeploymentInfo", () => {
		it("should successfully save deployment info to dynamo db", async () => {

			const createdAt = new Date();

			await cacheSuccessfulDeploymentInfo({
				gitHubBaseUrl: "https://github.com",
				repositoryId: 3,
				commitSha: "abc-abc-abc",
				env: "production",
				createdAt
			}, logger);

			const result = await ddb.getItem({
				TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_CACHE_TABLE_NAME,
				Key: {
					"Id": { "S": createHashWithoutSharedSecret(`ghurl_https://github.com_repo_3_env_production`) },
					"CreatedAt": { "N": String(createdAt.getTime()) }
				},
				AttributesToGet: [
					"Id", "CreatedAt",
					"GitHubInstallationId", "GitHubAppId", "RepositoryId",
					"CommitSha",
					"Env", "Status", "ExpiredAfter"
				]
			}).promise();

			expect(result.$response.error).toBeNull();
			expect(result.Item).toEqual({
				Id: { "S": createHashWithoutSharedSecret("ghurl_https://github.com_repo_3_env_production") },
				CreatedAt: { "N": String(createdAt.getTime()) },
				CommitSha: { "S": "abc-abc-abc" },
				ExpiredAfter: { "N": String(Math.floor((createdAt.getTime() + ONE_YEAR_IN_MILLISECONDS) / 1000)) }
			});
		});
	});

	describe("fetching back last success deployment", () => {
		const repositoryId = 222;
		const createdAt1 = new Date("2000-01-01");
		const createdAt2 = new Date("2000-02-02");
		const createdAt_between_2_and_3 = new Date("2000-02-15");
		const createdAt3 = new Date("2000-03-03");
		beforeEach(async () => {
			await cacheSuccessfulDeploymentInfo({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				commitSha: "create-1",
				env: "production",
				createdAt: createdAt1
			}, logger);
			await cacheSuccessfulDeploymentInfo({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				commitSha: "create-2",
				env: "production",
				createdAt: createdAt2
			}, logger);
			await cacheSuccessfulDeploymentInfo({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				commitSha: "create-3",
				env: "production",
				createdAt: createdAt3
			}, logger);
		});
		it("should fetch last success deployment", async () => {
			const result = await findLastSuccessDeploymentFromCache({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				env: "production", currentDate: createdAt2
			}, logger);
			expect(result).toEqual({
				commitSha: "create-1",
				createdAt: createdAt1
			});
		});
		it("should fetch THE last success deployment when more than one previous success deployments", async () => {
			const result = await findLastSuccessDeploymentFromCache({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				env: "production", currentDate: createdAt3
			}, logger);
			expect(result).toEqual({
				commitSha: "create-2",
				createdAt: createdAt2
			});
		});
		it("should fetch last success deployment for a date in between the dates in db", async () => {
			const result = await findLastSuccessDeploymentFromCache({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				env: "production", currentDate: createdAt_between_2_and_3
			}, logger);
			expect(result).toEqual({
				commitSha: "create-2",
				createdAt: createdAt2
			});
		});
		it("should return undefined if no past success deployment", async () => {
			const result = await findLastSuccessDeploymentFromCache({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				env: "production", currentDate: createdAt1
			}, logger);
			expect(result).toBeUndefined();
		});
	});
});
