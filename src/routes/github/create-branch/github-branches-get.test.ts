
import { getLogger } from "config/logger";
import { getBranchesNameQuery } from "~/src/github/client/github-queries";
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

		setupNock(req);
		await GithubBranchesGet(req, res);
		expect(res.send).toBeCalledWith(allBranches);
	});

	it.each(["githubToken", "jiraHost", "gitHubAppConfig"])("Should 401 without permission attributes", async (attribute) => {
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

const setupNock = (req) => {
	githubNock
		.post("/graphql", {
			query: getBranchesNameQuery,
			variables: {
				owner: req.params.owner,
				repo: req.params.repo,
				per_page: 100
			}
		})
		.reply(200, {
			"data": {
				"repository": {
					"refs": {
						"totalCount": 5,
						"edges": [
							{
								"cursor": "MQ",
								"node": {
									"name": "sample-patch-1"
								}
							},
							{
								"cursor": "Mg",
								"node": {
									"name": "sample-patch-2"
								}
							},
							{
								"cursor": "Mw",
								"node": {
									"name": "sample-patch-3"
								}
							}]
					}
				}
			}
		});

	githubNock
		.post("/graphql", {
			query: getBranchesNameQuery,
			variables: {
				owner: req.params.owner,
				repo: req.params.repo,
				per_page: 100,
				cursor: "Mw"
			}
		})
		.reply(200, {
			"data": {
				"repository": {
					"refs": {
						"totalCount": 5,
						"edges": [
							{
								"cursor": "Mk",
								"node": {
									"name": "sample-patch-4"
								}
							},
							{
								"cursor": "Mz",
								"node": {
									"name": "sample-patch-5"
								}
							}]
					}
				}
			}
		});
};
const allBranches = {
	"repository": {
		"refs": {
			"totalCount": 5,
			"edges": [
				{
					"cursor": "MQ",
					"node": {
						"name": "sample-patch-1"
					}
				},
				{
					"cursor": "Mg",
					"node": {
						"name": "sample-patch-2"
					}
				},
				{
					"cursor": "Mw",
					"node": {
						"name": "sample-patch-3"
					}
				}, {
					"cursor": "Mk",
					"node": {
						"name": "sample-patch-4"
					}
				},
				{
					"cursor": "Mz",
					"node": {
						"name": "sample-patch-5"
					}
				}]
		}
	}
};