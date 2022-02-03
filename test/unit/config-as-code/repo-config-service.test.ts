import { convertYamlToRepoConfig, saveRepoConfigToDB, hasTooManyPatternsPerEnvironment, isFileTooBig, getRepoConfigFromGitHub } from "../../../src/config-as-code/repo-config-service";

import RepoConfigDatabaseModel from "../../../src/config-as-code/repo-config-database-model";
import { RepoConfig } from "../../../src/config-as-code/repo-config";

const mockGetRepositoryContent = jest.fn().mockResolvedValue({ data: 1 });
jest.mock("../../../src/github/client/github-client", () => {
	return jest.fn().mockImplementation(() => {
		return {
			getRepositoryContent: mockGetRepositoryContent
		}
	})
})

jest.mock("../../../src/config-as-code/repo-config-database-model", () => ({
	saveOrUpdate: jest.fn().mockReturnValue("works")
}));

jest.mock("../../../src/github/client/installation-id", () => ({
	getCloudInstallationId: jest.fn().mockReturnValue(1)
}));

const VALID_CONFIG_OBJECT: RepoConfig = {
	deployments: {
		environmentMapping: {
			development: ["dev"],
			testing: ["test"],
			staging: ["stage"],
			production: ["prod"],
		}
	}
};

describe("config-as-code/repo-config-service", () => {

	describe("isFileTooBig()", () => {
		it("returns true if number exceeds maximum", async () => {
			expect(isFileTooBig(10000000000)).toBeTruthy();
		});

		it("returns false if number is within its bounds", async () => {
			expect(isFileTooBig(100)).toBeFalsy();
		});
	})

	describe("hasTooManyEnvironmentMappingTests()", () => {
		it("a small set of environment mapping tests should be false", async () => {
			expect(hasTooManyPatternsPerEnvironment(VALID_CONFIG_OBJECT)).toBeFalsy();
		});

		it("too many environment mapping tests should be true", async () => {
			const MOCK_CONFIG = JSON.parse(JSON.stringify(VALID_CONFIG_OBJECT));
			MOCK_CONFIG.deployments.environmentMapping.development = ["TEST1","TEST1","TEST1","TEST1","TEST1","TEST1","TEST1","TEST1"];
			expect(hasTooManyPatternsPerEnvironment(MOCK_CONFIG)).toBeTruthy();
		});
	})

	describe.skip("getRepoConfigFromGitHub()", () => {
		const githubInstallationId = 1;
		const owner = "owner";
		const repo = "repo";

		it("when no response body expect null", async () => {
			const response = await getRepoConfigFromGitHub(githubInstallationId, owner, repo);
			expect(response).toBeNull();
		});
	});

	describe("saveRepoConfigToDB()", () => {
		const GH_INSTALLATION_ID = 12345;
		const REPO_ID = 10;
		it("expect to call saveUpate database with correct arguments", async () => {
			await saveRepoConfigToDB(GH_INSTALLATION_ID, REPO_ID, VALID_CONFIG_OBJECT);
			expect(RepoConfigDatabaseModel.saveOrUpdate).toHaveBeenCalledWith(GH_INSTALLATION_ID, REPO_ID, VALID_CONFIG_OBJECT);
		});
	})

	describe("convertYamlToRepoConfig()", () => {

		it("valid yaml to json conversion", async () => {
			const MOCK_VALID_YAML =
`deployments:
  environmentMapping:
    development:
    - "dev"
    testing:
    - "test"
    staging:
    - "stage"
    production:
    - "prod"`
			const config = convertYamlToRepoConfig(MOCK_VALID_YAML);
			expect(config).toMatchObject(VALID_CONFIG_OBJECT);
		});
		it("should strip off any non valid attributes", async () => {
			const MOCK_EXTRA_YAML =
`deployments:
  environmentMapping:
    development:
    - "dev"
    testing:
    - "test"
    staging:
    - "stage"
    production:
    - "prod"
    unwantedAttribute:
    - "test"
  environmentMappingInvalid:
   development:
   - "dev"`
			const config = convertYamlToRepoConfig(MOCK_EXTRA_YAML);
			expect(JSON.stringify(config)).toEqual(JSON.stringify(VALID_CONFIG_OBJECT));
		});
	});
});
