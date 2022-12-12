
import { getLogger } from "config/logger";
import { GithubBranchesGet } from "~/src/routes/github/create-branch/github-branches-get";

describe("GitHub Branches Get", () => {

	let req, res;
	beforeEach(async () => {

		req = {
			log: getLogger("request"),
			params: {
				owner: "ARC",
				repo: "repo-1"
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

	it("Should fetch branches", async () => {
		setupNock();
		await GithubBranchesGet(req, res);
		expect(res.send).toBeCalledWith(response);
	});

	it.each(["githubToken", "gitHubAppConfig"])("Should 401 without permission attributes", async (attribute) => {
		delete res.locals[attribute];
		await GithubBranchesGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

	it.each(["owner", "repo"])("Should 400 when missing required fields", async (attribute) => {
		res.status.mockReturnValue(res);
		delete req.params[attribute];
		await GithubBranchesGet(req, res);
		expect(res.status).toHaveBeenCalledWith(400);
	});

});

const defaultBranch = "sample-patch-2";
const setupNock = () => {
	githubNock
		.get("/repos/ARC/repo-1/branches?per_page=100")
		.reply(200, allBranches);
	githubNock
		.get("/repos/ARC/repo-1")
		.reply(200, {
			default_branch: defaultBranch
		});
};

const allBranches = [
	{
		"name": "sample-patch-1",
		"id": "sample-patch-1"
	},
	{
		"name": "sample-patch-2",
		"id": "sample-patch-2"
	},
	{
		"name": "sample-patch-3",
		"id": "sample-patch-3"
	}
];
const response = {
	branches: allBranches.filter(branch => branch.name !== defaultBranch),
	defaultBranch: "sample-patch-2"
};
