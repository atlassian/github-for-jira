import { GithubManifestGet } from "~/src/routes/github/manifest/github-manifest-get";

describe("github-manifest-complete-get", () => {
	let req, res;

	beforeEach(async () => {
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


	it("Should throw error if GHE host missing", async () => {
		req.query.gheHost = undefined;
		await expect(GithubManifestGet(req, res))
			.rejects
			.toThrow("GHE URL not found");
	});

	it("Should return App manifest", async () => {
		await GithubManifestGet(req, res);
		expect(res.json).toBeCalledWith(expect.objectContaining({
			url: expect.any(String),
			redirect_url: expect.any(String),
			hook_attributes: expect.objectContaining({
				url: expect.any(String)
			}),
			setup_url: expect.any(String),
			callback_url: expect.any(String),
			default_permissions: expect.objectContaining({
				"actions": "read",
				"security_events": "read",
				"contents": "write",
				"deployments": "read",
				"issues": "write",
				"metadata": "read",
				"pull_requests": "write",
				"members": "read"
			}),
			default_events: expect.arrayContaining([
				"code_scanning_alert",
				"commit_comment",
				"create",
				"delete",
				"deployment_status",
				"issue_comment",
				"issues",
				"pull_request",
				"pull_request_review",
				"push",
				"repository",
				"workflow_run"
			])
		}));
	});
});
