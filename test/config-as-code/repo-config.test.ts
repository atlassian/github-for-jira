import { mapEnvironmentWithRepoConfig, RepoConfig } from "../../src/config-as-code/repo-config";
import vm from "vm";

describe("RepoConfig", () => {

	describe("mapEnvironmentWithRepoConfig()", () => {

		it("should map environments as expected", async () => {

			const repoConfig: RepoConfig = {
				deployments: {
					environmentMapping: {
						development: [
							"DEV-*",
							"development"
						],
						testing: [],
						staging: [
							"STG-*",
							"staging"
						],
						production: []
					}
				}
			};

			expect(mapEnvironmentWithRepoConfig("FOO", repoConfig)).toBe("unmapped");
			expect(mapEnvironmentWithRepoConfig("development123", repoConfig)).toBe("unmapped")
			expect(mapEnvironmentWithRepoConfig("production", repoConfig)).toBe("unmapped");

			expect(mapEnvironmentWithRepoConfig("development", repoConfig)).toBe("development");
			expect(mapEnvironmentWithRepoConfig("DEV-FOO", repoConfig)).toBe("development");

			expect(mapEnvironmentWithRepoConfig("staging", repoConfig)).toBe("staging");
			expect(mapEnvironmentWithRepoConfig("STG-FOO", repoConfig)).toBe("staging");

		});

		it("should map environments with incomplete RepoConfig", async () => {

			const repoConfig: RepoConfig = {
				deployments: {
					environmentMapping: {
						development: [
							"DEV-*",
							"development"
						]
					}
				}
			};

			expect(mapEnvironmentWithRepoConfig("development", repoConfig)).toBe("development");
			expect(mapEnvironmentWithRepoConfig("DEV-FOO", repoConfig)).toBe("development"); // does not result in "production" because "development" takes precedence
		});

		it("should follow precedence: development, testing, staging, production", async () => {

			const repoConfig: RepoConfig = {
				deployments: {
					environmentMapping: {
						development: [
							"DEV-*",
						],
						testing: [
							"DEV-*",
							"TEST-*"
						],
						staging: [
							"DEV-*",
							"TEST-*",
							"STG-*"
						],
						production: [
							"DEV-*",
							"TEST-*",
							"STG-*",
							"PROD-*"
						]

					}
				}
			};

			expect(mapEnvironmentWithRepoConfig("DEV-FOO", repoConfig)).toBe("development");
			expect(mapEnvironmentWithRepoConfig("TEST-FOO", repoConfig)).toBe("testing");
			expect(mapEnvironmentWithRepoConfig("STG-FOO", repoConfig)).toBe("staging");
			expect(mapEnvironmentWithRepoConfig("PROD-FOO", repoConfig)).toBe("production");
		});

		it("is not vulnerable to evil regular expressions (catastrophic backtracking)", () => {

			const repoConfig: RepoConfig = {
				deployments: {
					environmentMapping: {
						development: [
							// a regex vulnerable to catastrophic backtracking
							"A(B|C+)+D",
						],
					}
				}
			};

			const sandbox = {
				repoConfig,
				mapEnvironmentWithRepoConfig,
				// This environment triggers catastrophic backtracking when matched against the above regex that would take
				// a minute or so of compute time.
				environment: "ACCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCX"
			};

			// We have to move the evil regex evaluation to another process because it would otherwise block this process.
			const context = vm.createContext(sandbox);
			const script = new vm.Script("mapEnvironmentWithRepoConfig(environment, repoConfig);");

			// This will throw a timeout error if it takes too long.
			// No error = not vulnerable to evil regular expressions
			script.runInContext(context, { timeout: 1000 });
		});
	});

});
