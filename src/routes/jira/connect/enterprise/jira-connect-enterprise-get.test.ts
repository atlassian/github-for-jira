/* eslint-disable @typescript-eslint/no-explicit-any */
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Express } from "express";
import { getLogger } from "config/logger";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { Installation } from "models/installation";
import supertest from "supertest";
import { GitHubServerApp } from "models/github-server-app";
import { getFrontendApp } from "~/src/app";

describe("GET /jira/connect/enterprise", () => {

	let app: Express;
	let installation: Installation;

	beforeEach(() => {
		app = getFrontendApp();
	});

	const generateJwt = async (query: any = {}) => {
		return encodeSymmetric({
			qsh: createQueryStringHash({
				method: "GET",
				pathname: "/jira/connect/enterprise",
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	describe("returns unauthorised", () => {
		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;
		});

		it("when invalid JWT", async () => {
			const response = await supertest(app)
				.get("/jira/connect/enterprise")
				.query({
					jwt: "boo"
				});
			expect(response.status).toStrictEqual(401);
		});

		it("when no JWT", async () => {
			const response = await supertest(app)
				.get(`/jira/connect/enterprise?jiraHost=${installation.jiraHost}`)
				.set("Cookie", [`jiraHost=${installation.jiraHost}`]);

			expect(response.status).toStrictEqual(401);
		});
	});

	describe("with existing GHE servers", () => {
		let gitHubServerApp: GitHubServerApp;

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;
			gitHubServerApp = result.gitHubServerApp!;
		});

		it("renders list of servers with ADD_NEW_SERVER button", async () => {
			const response = await supertest(app)
				.get("/jira/connect/enterprise")
				.query({
					jwt: await generateJwt()
				});
			expect(response.text).toContain(gitHubServerApp.gitHubBaseUrl);
			expect(response.text).toContain(`data-identifier="${gitHubServerApp.uuid}"`);
			expect(response.text).toContain(`data-qs-for-path="{&quot;new&quot;:1}" data-path="github-server-url-page"`);
		});
	});

	describe("without existing GHE servers", () => {

		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forCloud().create();
			installation = result.installation;
		});

		it("renders GHE url page", async () => {
			const response = await supertest(app)
				.get("/jira/connect/enterprise")
				.query({
					jwt: await generateJwt()
				});
			expect(response.text).toContain(`<label for="gheServerURL">Server URL</label>`);
		});

		it("populates list of known HTTP headers", async () => {
			const response = await supertest(app)
				.get("/jira/connect/enterprise")
				.query({
					jwt: await generateJwt()
				});
			expect(response.text).toContain(`var knownHttpHeadersLowerCase = ["`);
			expect(response.text).toContain(`"sec-fetch-dest"`);
		});
	});

	describe("with new flag", () => {
		beforeEach(async () => {
			const result = await (new DatabaseStateCreator()).forServer().create();
			installation = result.installation;
		});

		it("renders GHE url page", async () => {
			const response = await supertest(app)
				.get("/jira/connect/enterprise")
				.query({
					jwt: await generateJwt({ new: "true" }),
					new: "true"
				});
			expect(response.text).toContain(`<label for="gheServerURL">Server URL</label>`);
		});
	});
});
