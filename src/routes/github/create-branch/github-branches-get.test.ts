
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

describe("Getting GitHub Branches securely avoiding XSS attacks", () => {
	let req, res;
	beforeEach(async () => {

		req = {
			log: getLogger("request"),
			params: {
				owner: "Hacker",
				repo: "xss-test"
			}
		};

		res = {
			sendStatus: jest.fn(),
			send: jest.fn(),
			status: jest.fn(),
			json: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "random-token",
				gitHubAppConfig: {}
			}
		};
	});
	it("Should fetch branches securely", async () => {
		setupNockForXSSBranches();
		await GithubBranchesGet(req, res);
		expect(res.send).toBeCalledWith(responseForXSSBranches);
	});
});

const defaultBranchForXSS = "DEFAULTTESTXSS\"><script>alert('🔫🔫🔫🔫🔫🔫')</script>";
const setupNockForXSSBranches = () => {
	githubNock
		.get("/repos/Hacker/xss-test/branches?per_page=100")
		.reply(200, XSSBranches);
	githubNock
		.get("/repos/Hacker/xss-test")
		.reply(200, {
			default_branch: defaultBranchForXSS
		});
};
const XSSBranches = [
	{
		"name": "TESTXSS\"><img/src/onerror=alert(\"You've been hit by\")>",
		"id": "first-xss"
	},
	{
		"name": "TESTXSS2\"><script>alert('A smooth criminal!!')</script>",
		"id": "second-xss"
	},
	{
		"name": "DEFAULTTESTXSS\"><script>alert('🔫🔫🔫🔫🔫🔫')</script>",
		"id": "default-xss"
	}
];
const responseForXSSBranches = {
	branches: [
		{
			"name": "TESTXSS\"&gt;",
			"id": "first-xss"
		},
		{
			"name": "TESTXSS2\"&gt;",
			"id": "second-xss"
		}
	],
	defaultBranch: "DEFAULTTESTXSS\"&gt;"
};