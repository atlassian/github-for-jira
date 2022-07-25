import { GithubManifestGet } from "~/src/routes/github/manifest/github-manifest-get";
import { readFileSync, existsSync } from "fs";
import { envVars } from "~/src/config/env";

jest.mock("fs");

describe("github-manifest-complete-get", () => {
	let req, res;

	beforeEach(async() => {
		req = {
			query: {
				gheHost: "http://example.com"
			},
			session: {
			}
		};

		res = {
			json: jest.fn()
		};
	});

	it("Should get manifest configuration", async () => {
		const manifestTemplateJson = {
			"name": "ghe-app-for-jira",
			"redirect_url": "<<APP_HOST>>/github/manifest"
		};
		jest.mocked(existsSync).mockReturnValue(true);
		jest.mocked(readFileSync).mockReturnValue(JSON.stringify(manifestTemplateJson));

		await GithubManifestGet(req, res);
		const manifestJson = {
			"name": "ghe-app-for-jira",
			"redirect_url": `${envVars.APP_URL}/github/manifest`
		};
		expect(res.json).toBeCalledWith(manifestJson);
	});

	it("Should set session object", async () => {
		const manifestTemplateJson = {
			"name": "ghe-app-for-jira",
			"redirect_url": "<<APP_HOST>>/github/manifest"
		};
		jest.mocked(existsSync).mockReturnValue(true);
		jest.mocked(readFileSync).mockReturnValue(JSON.stringify(manifestTemplateJson));

		await GithubManifestGet(req, res);

		expect(req.session).toEqual(expect.objectContaining({
			temp: { gheHost: req.query.gheHost }
		}));
	});

	it("Should throw error if manifest template missing", async () => {
		jest.mocked(existsSync).mockReturnValue(false);

		await expect(GithubManifestGet(req, res))
			.rejects
			.toThrow("GHE app manifest template not found");

	});
});