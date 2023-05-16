import { getLogger } from "config/logger";
import { envVars } from "config/env";
import { saveDeploymentInfo, findLastSuccessDeployment } from "./deployment-service";
import { dynamodb as ddb } from "models/dynamodb";
import { hash } from "utils/hash-utils";

const logger = getLogger("test");
const ONE_YEAR_IN_MILLISECONDS = 365 * 24 * 60 * 60 * 1000;

describe("Deployment status service", () => {

	describe("saveDeploymentInfo", () => {
		it("should successfully save deployment info to dynamo db", async () => {

			const createdAt = new Date();

			await saveDeploymentInfo({
				gitHubBaseUrl: "https://github.com",
				gitHubInstallationId: 1,
				repositoryId: 3,
				commitSha: "abc-abc-abc",
				env: "production",
				status: "success",
				createdAt
			}, logger);

			const result = await ddb.getItem({
				TableName: envVars.DYNAMO_DEPLOYMENT_HISTORY_TABLE_NAME,
				Key: {
					"GitHubRepoEnvKey": { "S": hash(`ghurl_https://github.com_repo_3_env_production`) },
					"StatusCreatedAt": { "N": String(createdAt.getTime()) }
				},
				AttributesToGet: [
					"GitHubRepoEnvKey", "StatusCreatedAt",
					"GitHubInstallationId", "GitHubAppId", "RepositoryId",
					"CommitSha",
					"Env", "Status", "ExpiredAfter"
				]
			}).promise();

			expect(result.$response.error).toBeNull();
			expect(result.Item).toEqual({
				GitHubRepoEnvKey: { "S": hash("ghurl_https://github.com_repo_3_env_production") },
				StatusCreatedAt: { "N": String(createdAt.getTime()) },
				GitHubInstallationId: { "N": "1" },
				RepositoryId: { "N": "3" },
				CommitSha: { "S": "abc-abc-abc" },
				Env: { "S": "production" },
				Status: { "S": "success" },
				ExpiredAfter: { "N": String(Math.floor((createdAt.getTime() + ONE_YEAR_IN_MILLISECONDS) / 1000)) }
			});
		});
	});

	describe("fetching back last success deployment", () => {
		const gitHubInstallationId = 111;
		const repositoryId = 222;
		const createdAt1 = new Date("2000-01-01");
		const createdAt2 = new Date("2000-02-02");
		const createdAt_between_2_and_3 = new Date("2000-02-15");
		const createdAt3 = new Date("2000-03-03");
		beforeEach(async () => {
			await saveDeploymentInfo({
				gitHubBaseUrl: "https://github.com",
				gitHubInstallationId, repositoryId,
				commitSha: "create-1",
				env: "production", status: "success",
				createdAt: createdAt1
			}, logger);
			await saveDeploymentInfo({
				gitHubBaseUrl: "https://github.com",
				gitHubInstallationId, repositoryId,
				commitSha: "create-2",
				env: "production", status: "success",
				createdAt: createdAt2
			}, logger);
			await saveDeploymentInfo({
				gitHubBaseUrl: "https://github.com",
				gitHubInstallationId, repositoryId,
				commitSha: "create-3",
				env: "production", status: "success",
				createdAt: createdAt3
			}, logger);
		});
		it("should fetch last success deployment", async () => {
			const result = await findLastSuccessDeployment({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				env: "production", currentDate: createdAt2
			}, logger);
			expect(result).toEqual({
				repositoryId,
				commitSha: "create-1",
				createdAt: createdAt1
			});
		});
		it("should fetch THE last success deployment when more than one previous success deployments", async () => {
			const result = await findLastSuccessDeployment({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				env: "production", currentDate: createdAt3
			}, logger);
			expect(result).toEqual({
				repositoryId,
				commitSha: "create-2",
				createdAt: createdAt2
			});
		});
		it("should fetch last success deployment for a date in between the dates in db", async () => {
			const result = await findLastSuccessDeployment({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				env: "production", currentDate: createdAt_between_2_and_3
			}, logger);
			expect(result).toEqual({
				repositoryId,
				commitSha: "create-2",
				createdAt: createdAt2
			});
		});
		it("should return undefined if no past success deployment", async () => {
			const result = await findLastSuccessDeployment({
				gitHubBaseUrl: "https://github.com",
				repositoryId,
				env: "production", currentDate: createdAt1
			}, logger);
			expect(result).toBeUndefined();
		});
	});
});
