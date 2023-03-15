import { GithubManifestGet } from "~/src/routes/github/manifest/github-manifest-get";
import { envVars } from "config/env";

describe("github-manifest-complete-get", () => {
	let req, res;

	beforeEach(async () => {
		res = {
			render: jest.fn().mockReturnValue({}),
			locals: { nonce: "nonce" }
		};
	});

	it("Should return Manifest View", async () => {
		await GithubManifestGet(req, res);

		expect(res.render.mock.calls[0][1]).toHaveProperty("uuid");

		expect(res.render.mock.calls[0][0]).toBe("github-manifest.hbs");
		expect(res.render.mock.calls[0][1].nonce).toBe("nonce");
		expect(res.render.mock.calls[0][1].appHost).toBe(envVars.APP_URL);
		expect(res.render.mock.calls[0][1].title).toBe("Creating manifest and redirecting to your GitHub Enterprise Server instance");
	});
});
