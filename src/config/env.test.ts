/* eslint-disable @typescript-eslint/no-explicit-any */
import { envVars } from "./env";
import { EnvironmentEnum } from "interfaces/common";

describe("environment variables", () => {
	it("Should get all test env vars at startup", () => {
		expect(envVars.LOG_LEVEL).toBeDefined();
		expect(envVars.NODE_ENV).toBe(EnvironmentEnum.test);
	});

	it("Should get newly added variable to process.env in envVars", () => {
		process.env.TEST_VAR = "test";
		expect((envVars as any).TEST_VAR).toBe("test");
	});

	it("Should get the transformed value from envVars", () => {
		process.env.EXTERNAL_ONLY_PROXY_HOST = "blah.com";
		process.env.EXTERNAL_ONLY_PROXY_PORT = "420";
		expect(envVars.PROXY).toBe("http://blah.com:420");
	});

	it("Should not be able to change variables in envVars", () => {
		process.env.NODE_ENV = EnvironmentEnum.production;
		expect(envVars.NODE_ENV).toBe(EnvironmentEnum.test);
		process.env.NODE_ENV = EnvironmentEnum.test;
	});

	it("Should not change process.env when changing a variable in envVars", () => {
		envVars.NODE_ENV = EnvironmentEnum.production;
		expect(process.env.NODE_ENV).toBe("test");
	});

	describe("WEBHOOK_SECRETS", () => {
		let oldWebhookSecrets;
		beforeEach(() => {
			oldWebhookSecrets = process.env.WEBHOOK_SECRETS;
		});
		afterEach(() => {
			process.env.WEBHOOK_SECRETS = oldWebhookSecrets;
		});

		it("should convert a string to an array", () => {
			process.env.WEBHOOK_SECRETS = "abc";
			expect(envVars.WEBHOOK_SECRETS).toStrictEqual(["abc"]);
		});

		it("should parse json array", () => {
			process.env.WEBHOOK_SECRETS = `["abc", "qwe"]`;
			expect(envVars.WEBHOOK_SECRETS).toStrictEqual(["abc", "qwe"]);
		});

		it("should return empty array when undefined or null", () => {
			delete process.env.WEBHOOK_SECRETS;
			expect(envVars.WEBHOOK_SECRETS).toStrictEqual([]);
		});
	});
});
