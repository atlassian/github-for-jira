import { getFrontendApp } from "~/src/app";
import { Express } from "express";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Installation } from "models/installation";
import supertest from "supertest";
import { GheConnectConfigTempStorage } from "utils/ghe-connect-config-temp-storage";
import { GitHubServerApp } from "models/github-server-app";

describe("jira-connect-enterprise-app-create-or-edit-get", () => {

	let app: Express;
	let installation: Installation;
	let gheServerApp: GitHubServerApp;

	beforeEach(async () => {
		app = getFrontendApp();

		const result = await new DatabaseStateCreator().forServer().create();
		installation = result.installation;
		gheServerApp = result.gitHubServerApp!;
	});

	describe("new", () => {

		describe("unauthorized", () => {
			it("returns 401 when JWT is invalid", async () => {
				const response = await supertest(app)
					.get("/jira/connect/enterprise/123/app/new")
					.query({
						jwt: "bar"
					});
				expect(response.status).toStrictEqual(401);
			});

			it("returns 401 JWT is missing", async () => {
				const response = await supertest(app)
					.get("/jira/connect/enterprise/123/app/new")
					.query({
						jiraHost: installation.jiraHost
					})
					.set("Cookie", [`jiraHost=${installation.jiraHost}`]);
				expect(response.status).toStrictEqual(401);
			});
		});

		describe("authorized", () => {

			const generateJwt = async (uuid: string, query: any = {}) => {
				return encodeSymmetric({
					qsh: createQueryStringHash({
						method: "GET",
						pathname: `/jira/connect/enterprise/${uuid}/app/new`,
						query
					}, false),
					iss: installation.plainClientKey
				}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
			};

			it("renders creation form and puts connect config onto page from temp storage", async () => {
				const uuid = await new GheConnectConfigTempStorage().store({
					serverUrl: "http://foobar.com"
				}, installation.id);

				const response = await supertest(app)
					.get(`/jira/connect/enterprise/${uuid}/app/new`)
					.query({
						jwt: await generateJwt(uuid)
					});
				expect(response.status).toStrictEqual(200);
				expect(response.text).toContain(`<input type="hidden" name="uuid" value="${uuid}">`);
				expect(response.text).toContain(`<input type="hidden" id="gitHubBaseUrl" name="gitHubBaseUrl" value="http://foobar.com">`);
			});

			it("renders creation form and puts connect config onto page from existing ghe", async () => {
				const response = await supertest(app)
					.get(`/jira/connect/enterprise/${gheServerApp.uuid}/app/new`)
					.query({
						jwt: await generateJwt(gheServerApp.uuid)
					});
				expect(response.status).toStrictEqual(200);
				expect(response.text).toContain(`<input type="hidden" id="gitHubBaseUrl" name="gitHubBaseUrl" value="${gheServerApp.gitHubBaseUrl}">`);
			});

			it("does not reuse GHE uuid", async () => {
				const response = await supertest(app)
					.get(`/jira/connect/enterprise/${gheServerApp.uuid}/app/new`)
					.query({
						jwt: await generateJwt(gheServerApp.uuid)
					});
				expect(response.text).not.toContain(`<input type="hidden" name="uuid" value="${gheServerApp.uuid}">`);
				expect(response.text).toMatch(/<input type="hidden" name="uuid" value="[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}">/);
			});

			it("returns 404 when unknown UUID", async () => {
				const TEST_UUID = "c7a17b54-2e37-415b-bba1-7d62fa2d2a7f";
				const response = await supertest(app)
					.get(`/jira/connect/enterprise/${TEST_UUID}/app/new`)
					.query({
						jwt: await generateJwt(TEST_UUID)
					});
				expect(response.status).toStrictEqual(404);
			});

			it("returns 404 when UUID from a different installation", async () => {
				const anotherOne = await new DatabaseStateCreator().forServer().create();
				const response = await supertest(app)
					.get(`/jira/connect/enterprise/${anotherOne.gitHubServerApp!.uuid}/app/new`)
					.query({
						jwt: await generateJwt(anotherOne.gitHubServerApp!.uuid)
					});
				expect(response.status).toStrictEqual(404);
			});
		});
	});

	describe("edit form", () => {

		describe("unauthorized", () => {
			describe("unauthorized", () => {
				it("returns 401 when JWT is invalid", async () => {
					const response = await supertest(app)
						.get("/jira/connect/enterprise/app/123")
						.query({
							jwt: "bar"
						});
					expect(response.status).toStrictEqual(401);
				});

				it("returns 401 JWT is missing", async () => {
					const response = await supertest(app)
						.get("/jira/connect/enterprise/app/123")
						.query({
							jiraHost: installation.jiraHost
						})
						.set("Cookie", [`jiraHost=${installation.jiraHost}`]);
					expect(response.status).toStrictEqual(401);
				});
			});
		});

		describe("authorized", () => {
			const generateJwt = async (uuid: string, query: any = {}) => {
				return encodeSymmetric({
					qsh: createQueryStringHash({
						method: "GET",
						pathname: `/jira/connect/enterprise/app/${uuid}`,
						query
					}, false),
					iss: installation.plainClientKey
				}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
			};

			it("renders edit form and fills up data from database config", async () => {
				const response = await supertest(app)
					.get(`/jira/connect/enterprise/app/${gheServerApp.uuid}`)
					.query({
						jwt: await generateJwt(gheServerApp.uuid)
					});
				expect(response.status).toStrictEqual(200);
				expect(response.text).toContain(`value="${gheServerApp.gitHubAppName}"`);
				expect(response.text).toContain(`value="https://test-github-app-instance.com/github/${gheServerApp.uuid}/callback"`);
				expect(response.text).toContain(`value="https://test-github-app-instance.com/github/${gheServerApp.uuid}/setup"`);
				expect(response.text).toContain(`value="https://test-github-app-instance.com/github/${gheServerApp.uuid}/webhooks"`);
				expect(response.text).toContain(`value="${await gheServerApp.getDecryptedWebhookSecret(installation.jiraHost)}"`);
				expect(response.text).toContain(`value="${gheServerApp.appId}"`);
				expect(response.text).toContain(`value="${gheServerApp.gitHubClientId}"`);
				expect(response.text).toContain(`value="${await gheServerApp.getDecryptedGitHubClientSecret(installation.jiraHost)}"`);
				expect(response.text).toContain(`<input type="hidden" name="uuid" value="${gheServerApp.uuid}">`);
				expect(response.text).toContain(`data-app-uuid="${gheServerApp.uuid}"`);
				expect(response.text).toContain(`data-app-appname="${gheServerApp.gitHubAppName}"`);
				expect(response.text).toContain(`<input type="hidden" id="gitHubBaseUrl" name="gitHubBaseUrl" value="${gheServerApp.gitHubBaseUrl}">`);
			});

			it("returns 404 when unknown UUID", async () => {
				const TEST_UUID = "c7a17b54-2e37-415b-bba1-7d62fa2d2a7f";
				const response = await supertest(app)
					.get(`/jira/connect/enterprise/app/${TEST_UUID}`)
					.query({
						jwt: await generateJwt(TEST_UUID)
					});
				expect(response.status).toStrictEqual(404);
			});

			it("returns 404 when UUID from a different installation", async () => {
				const anotherOne = await new DatabaseStateCreator().forServer().create();
				const response = await supertest(app)
					.get(`/jira/connect/enterprise/app/${anotherOne.gitHubServerApp!.uuid}`)
					.query({
						jwt: await generateJwt(anotherOne.gitHubServerApp!.uuid)
					});
				expect(response.status).toStrictEqual(404);
			});
		});
	});

});
