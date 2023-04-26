
import { getLogger } from "config/logger";
import { GithubBranchGet } from "routes/github/branch/github-branch-get";

describe("GitHub Branches Get", () => {

	let req, res;
	beforeEach(async () => {

		req = {
			log: getLogger("request"),
			params: {
				owner: "ARC",
				repo: "repo-1",
				ref: "branch-01"
			}
		};

		res = {
			sendStatus: jest.fn(),
			send: jest.fn(),
			status: jest.fn(),
			json: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token",
				gitHubAppConfig: {}
			}
		};
	});

	it("Should successfully fetch branch", async () => {
		githubNock
			.get("/repos/ARC/repo-1/git/refs/heads/branch-01")
			.reply(200, {});
		await GithubBranchGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(200);
	});

	it("Should return 404 when no branch found", async () => {
		githubNock
			.get("/repos/ARC/repo-1/git/refs/heads/branch-01")
			.reply(404, {});
		await GithubBranchGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(404);
	});

	it.each(["githubToken", "gitHubAppConfig"])("Should 401 without permission attributes", async (attribute) => {
		delete res.locals[attribute];
		await GithubBranchGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

});

