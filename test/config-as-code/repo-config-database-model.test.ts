import RepoConfigDatabaseModel from "../../src/config-as-code/repo-config-database-model";
import { RepoConfig } from "../../src/config-as-code/repo-config";

const exampleRepoConfig: RepoConfig = {
	deployments: {
		environmentMapping: {
			development: ["devRegex"],
			testing: ["testingRegex"],
			staging: ["stagingRegex"],
			production: ["productionRegex"],
		}
	}
};

const exampleRepoConfig2: RepoConfig = {
	deployments: {
		environmentMapping: {
			development: ["devRegex", "anotherRegex"],
			testing: ["testingRegex"],
			staging: ["stagingRegex", "anotherRegex"],
			production: ["productionRegex"],
		}
	}
};

describe("RepoConfigDatabaseModel", () => {

	afterEach(async () => {
		await Promise.all([
			RepoConfigDatabaseModel.destroy({ truncate: true }),
		]);
	});

	describe("saveOrUpdate", () => {
		it("should save and update a RepoConfig", async () => {
			// insert a new record
			await RepoConfigDatabaseModel.saveOrUpdate(42, 4711, exampleRepoConfig);
			const result = await RepoConfigDatabaseModel.getForRepo(42, 4711);
			expect(result).toEqual(exampleRepoConfig);

			// update the existing record
			await RepoConfigDatabaseModel.saveOrUpdate(42, 4711, exampleRepoConfig2);
			const updatedResult = await RepoConfigDatabaseModel.getForRepo(42, 4711);
			expect(updatedResult).toEqual(exampleRepoConfig2);
		});

	});

});
