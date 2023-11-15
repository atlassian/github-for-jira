import supertest from "supertest";
import { getFrontendApp } from "../../../app";
import { Installation } from "models/installation";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { runCurl } from "utils/curl/curl-utils";
import { when } from "jest-when";

jest.mock("utils/curl/curl-utils");

describe("GHESVerifyGetApps", () => {

	const makeApiCall = (gitHubAppId: string | number) => {
		return supertest(getFrontendApp())
			.post(`/api/verify/githubapp/${gitHubAppId}/verify-get-apps`)
			.set("X-Slauth-Mechanism", "test")
			.send();
	};

	let db;
	beforeEach(async () => {
		db = await new DatabaseStateCreator().forServer().create();
	});

	it("should return 400 on invalid gitHubAppId", async () => {
		await makeApiCall("blah").expect(400);
	});

	it("should return 400 on missing gitHubServerApp", async () => {
		await makeApiCall("123").expect(400);
	});

	it("should return 400 on missing jira installation", async () => {
		await Installation.destroy({ where: { id: db.installation.id } });
		await makeApiCall(db.gitHubServerApp!.id).expect(400);
	});

	it("should return gitHub app data from github successfully", async () => {
		gheApiNock.get("/app").reply(200, { appName: "test1", appSecrets: "123456" });
		await makeApiCall(db.gitHubServerApp!.id)
			.expect(200, { appName: "test1", appSecrets: "123456" });
	});

	it("should call curl command to fetch more info", async () => {

		gheApiNock.get("/app").reply(401);

		when(runCurl).calledWith({
			authorization: expect.anything(),
			fullUrl: `${gheApiUrl}/app`,
			method: "GET"
		}).mockResolvedValue({
			body: "curl resp body",
			meta: "random meta value"
		});

		const res = await makeApiCall(db.gitHubServerApp!.id);

		expect(res.status).toEqual(500);
		expect(res.body).toEqual(expect.objectContaining({
			output: {
				body: "curl resp body",
				meta: "random meta value"
			}
		}));

	});
});
