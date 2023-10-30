
import { getLogger } from "config/logger";
import { GithubBranchGet } from "routes/github/branch/github-branch-get";
import { mocked } from "jest-mock";
import { Subscription } from "models/subscription";

jest.mock("models/subscription");

describe("GitHub Branches Get", () => {

	let req, res;
	const gitHubInstallationId = 15;
	beforeEach(async () => {

		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

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
			.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
			.reply(200);

		githubNock
			.get("/repos/ARC/repo-1/git/refs/heads/branch-01")
			.reply(200, {});

		mocked(Subscription.findForRepoNameAndOwner).mockResolvedValue({ gitHubInstallationId, id: 1 } as Subscription);
		await GithubBranchGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(200);
	});

	it("Should return 404 when no branch found", async () => {

		githubNock
			.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
			.reply(200);

		githubNock
			.get("/repos/ARC/repo-1/git/refs/heads/branch-01")
			.reply(404, {});
		mocked(Subscription.findForRepoNameAndOwner).mockResolvedValue({ gitHubInstallationId, id: 1 } as Subscription);
		await GithubBranchGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(404);
	});

	it("Should 401 without gitHubAppConfig attributes", async () => {
		delete res.locals.gitHubAppConfig;
		await GithubBranchGet(req, res);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

});

