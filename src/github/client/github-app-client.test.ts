import { GitHubAppClient } from "./github-app-client";
import { numberFlag, NumberFlags } from "config/feature-flags";
import { when } from "jest-when";
import { getLogger } from "config/logger";
import fs from "fs";
import path from "path";
import { envVars } from "config/env";

jest.mock("config/feature-flags");
const log = getLogger("test");

const APP_ID = "11111";
const TEN_MINUTES = 10 * 60 * 1000;
const ONE_SEC_IN_MILLISE = 1000;
const PRIVATE_KEY = fs.readFileSync(path.join(process.cwd(), envVars.PRIVATE_KEY_PATH), "utf-8");

describe("GitHubAppClient", () => {
	describe("App token", () => {
		describe("With new exp time settings in ff turn on", () => {
			beforeEach(async () => {
				when(numberFlag)
					.calledWith(NumberFlags.APP_TOKEN_EXP_IN_MILLI_SEC, expect.anything(), expect.anything())
					.mockResolvedValue(ONE_SEC_IN_MILLISE);
			});
			it("should use the the provided exp timeout", async () => {

				let expTimeInMillSec: number | undefined;

				githubNock.get("/app")
					.matchHeader("Authorization", (authTokenBearer) => {
						const token = authTokenBearer.substring("Bearer ".length);
						const parts = token.split(".").map(p => Buffer.from(p, "base64").toString());
						expTimeInMillSec = JSON.parse(parts[1]).exp * 1000;
						return true;
					})
					.reply(200, {
						name: "app1"
					});

				const startTime = new Date().getTime();
				const appClient = new GitHubAppClient({
					apiUrl: "https://api.github.com",
					baseUrl: "https://api.github.com",
					graphqlUrl: "https://api.github.com/graphql",
					hostname: "github.com"
				}, jiraHost, { trigger: "test" }, log, APP_ID, PRIVATE_KEY);

				const app = (await appClient.getApp()).data;

				expect(app).toMatchObject({
					name: "app1"
				});

				expect(expTimeInMillSec).toBeDefined();
				const diff = expTimeInMillSec!- startTime;
				expect(diff).toBeGreaterThan(0);
				expect(diff).toBeLessThanOrEqual(ONE_SEC_IN_MILLISE);
			});
		});
		describe("With new exp time settings in ff turn off", () => {
			it("should use the the buildin exp timeout", async () => {

				let expTimeInMillSec: number | undefined;

				githubNock.get("/app")
					.matchHeader("Authorization", (authTokenBearer) => {
						const token = authTokenBearer.substring("Bearer ".length);
						const parts = token.split(".").map(p => Buffer.from(p, "base64").toString());
						expTimeInMillSec = JSON.parse(parts[1]).exp * 1000;
						return true;
					})
					.reply(200, {
						name: "app1"
					});

				const startTime = new Date().getTime();
				const appClient = new GitHubAppClient({
					apiUrl: "https://api.github.com",
					baseUrl: "https://api.github.com",
					graphqlUrl: "https://api.github.com/graphql",
					hostname: "github.com"
				}, jiraHost, { trigger: "test" }, log, APP_ID, PRIVATE_KEY);

				const app = (await appClient.getApp()).data;

				expect(app).toMatchObject({
					name: "app1"
				});

				expect(expTimeInMillSec).toBeDefined();
				const diff = expTimeInMillSec!- startTime;
				expect(diff).toBeGreaterThan(0);
				expect(Math.abs(TEN_MINUTES - diff)).toBeLessThan(1000);
			});
		});
	});
});
