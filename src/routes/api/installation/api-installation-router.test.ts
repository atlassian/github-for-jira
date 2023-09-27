import { Application } from "express";
import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { when } from "jest-when";
import { ApiInstallationGet } from "./api-installation-get";
import { ApiInstallationSyncstateGet } from "./api-installation-syncstate-get";

const featureFlags = jest.mock("config/feature-flags") as any;
featureFlags.booleanFlag = () => { return Promise.resolve(false); };
jest.mock("./api-installation-get");
jest.mock("./api-installation-syncstate-get");

const mockApiGetReturn200OK = () => {
	when(jest.mocked(ApiInstallationGet))
		.mockImplementation(async (_req, res)=>{
			res.status(200).send("");
		});
	when(jest.mocked(ApiInstallationSyncstateGet))
		.mockImplementation(async (_req, res)=>{
			res.status(200).send("");
		});
};

describe("Api Installation Routes", () => {
	describe("Supporting GHES", () => {
		let app: Application;
		beforeEach(() => {
			app = getFrontendApp();
		});
		describe("Backward compatible with cloud", () => {
			const CLOUD_GITHUB_INSTALLATION_ID = 1234;
			it("should call api installation get route correctly", async ()=>{
				mockApiGetReturn200OK();
				await supertest(app)
					.get(`/api/${CLOUD_GITHUB_INSTALLATION_ID}`)
					.set("X-Slauth-Mechanism", "test")
					.expect(200);
				expect(ApiInstallationGet).toHaveBeenCalledWith(expect.objectContaining({
					params: expect.objectContaining({
						installationId: CLOUD_GITHUB_INSTALLATION_ID.toString()
					})
				}), expect.anything(), expect.anything());
			});
			it("should call api installation sync state get route correctly", async ()=>{
				mockApiGetReturn200OK();
				await supertest(app)
					.get(`/api/${CLOUD_GITHUB_INSTALLATION_ID}/${encodeURIComponent(jiraHost)}/syncstate/`)
					.set("X-Slauth-Mechanism", "test")
					.expect(200);
				expect(ApiInstallationSyncstateGet).toHaveBeenCalledWith(expect.objectContaining({
					params: expect.objectContaining({
						installationId: CLOUD_GITHUB_INSTALLATION_ID.toString(),
						jiraHost
					})
				}), expect.anything(), expect.anything());
			});
		});
		describe("Compatible with GHES", () => {
			const GHES_GITHUB_INSTALLATION_ID = 5678;
			const GHES_GITUUB_APP_ID = 9001;
			it("should call api installation get route correctly", async ()=>{
				mockApiGetReturn200OK();
				await supertest(app)
					.get(`/api/${GHES_GITHUB_INSTALLATION_ID}/githubapp/${GHES_GITUUB_APP_ID}/`)
					.set("X-Slauth-Mechanism", "test")
					.expect(200);
				expect(ApiInstallationGet).toHaveBeenCalledWith(expect.objectContaining({
					params: expect.objectContaining({
						installationId: GHES_GITHUB_INSTALLATION_ID.toString(),
						gitHubAppId: GHES_GITUUB_APP_ID.toString()
					})
				}), expect.anything(), expect.anything());
			});
			it("should call api installation sync state get route correctly", async ()=>{
				mockApiGetReturn200OK();
				await supertest(app)
					.get(`/api/${GHES_GITHUB_INSTALLATION_ID}/githubapp/${GHES_GITUUB_APP_ID}/${encodeURIComponent(jiraHost)}/syncstate/`)
					.set("X-Slauth-Mechanism", "test")
					.expect(200);
				expect(ApiInstallationSyncstateGet).toHaveBeenCalledWith(expect.objectContaining({
					params: expect.objectContaining({
						installationId: GHES_GITHUB_INSTALLATION_ID.toString(),
						jiraHost,
						gitHubAppId: GHES_GITUUB_APP_ID.toString()
					})
				}), expect.anything(), expect.anything());
			});
		});
	});
});
