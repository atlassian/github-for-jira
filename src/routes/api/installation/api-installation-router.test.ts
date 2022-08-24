import { Application } from "express";
import supertest from "supertest";
import { getFrontendApp } from "~/src/app";
import { when } from "jest-when";
import { BooleanFlags, booleanFlag } from "config/feature-flags";
import { ApiInstallationGet } from "./api-installation-get";
import { ApiInstallationSyncstateGet } from "./api-installation-syncstate-get";
import { v4 as UUID } from "uuid";

jest.mock("config/feature-flags");
jest.mock("./api-installation-get");
jest.mock("./api-installation-syncstate-get");

const setupAppAndRouter = () => {
	return getFrontendApp({
		getSignedJsonWebToken: () => "",
		getInstallationAccessToken: async () => ""
	});
};

const turnOnGHESFF = () => {
	when(jest.mocked(booleanFlag))
		.calledWith(BooleanFlags.GHE_SERVER, expect.anything(), expect.anything())
		.mockResolvedValue(true);
};

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
			turnOnGHESFF();
			app = setupAppAndRouter();
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
			const GHES_GITUUB_APP_UUID = UUID();
			it("should call api installation get route correctly", async ()=>{
				mockApiGetReturn200OK();
				await supertest(app)
					.get(`/api/${GHES_GITHUB_INSTALLATION_ID}/githubapp/${GHES_GITUUB_APP_UUID}/`)
					.set("X-Slauth-Mechanism", "test")
					.expect(200);
				expect(ApiInstallationGet).toHaveBeenCalledWith(expect.objectContaining({
					params: expect.objectContaining({
						installationId: GHES_GITHUB_INSTALLATION_ID.toString(),
						uuid: GHES_GITUUB_APP_UUID
					})
				}), expect.anything(), expect.anything());
			});
			it("should call api installation sync state get route correctly", async ()=>{
				mockApiGetReturn200OK();
				await supertest(app)
					.get(`/api/${GHES_GITHUB_INSTALLATION_ID}/githubapp/${GHES_GITUUB_APP_UUID}/${encodeURIComponent(jiraHost)}/syncstate/`)
					.set("X-Slauth-Mechanism", "test")
					.expect(200);
				expect(ApiInstallationSyncstateGet).toHaveBeenCalledWith(expect.objectContaining({
					params: expect.objectContaining({
						installationId: GHES_GITHUB_INSTALLATION_ID.toString(),
						jiraHost,
						uuid: GHES_GITUUB_APP_UUID
					})
				}), expect.anything(), expect.anything());
			});
		});
	});
});
