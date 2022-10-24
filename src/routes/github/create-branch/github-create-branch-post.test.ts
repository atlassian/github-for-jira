/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { GithubCreateBranchPost } from "./github-create-branch-post";
import { getLogger } from "config/logger";
import { mocked } from "ts-jest/utils";

jest.mock("models/subscription");

describe("github-create-branch", () => {
	const gitHubInstallationId = 15;
	let req, res;

	beforeEach(async () => {
		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		await Installation.create({
			jiraHost,
			clientKey: "client-key",
			encryptedSharedSecret: "shared-secret"
		});

		req = {
			log: getLogger("request"),
			params: {},
			body: {
				owner: "ARC",
				repo: "cat-photos",
				sourceBranchName: "main",
				newBranchName: "chesire"
			}
		};

		res = {
			sendStatus: jest.fn(),
			status: jest.fn(),
			json: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token",
				gitHubAppConfig: {
					hostname: "omega"
				}
			}
		};
	});

	it("Should successfully run through the create branch flow", async () => {

		// Get reference
		githubNock
			.get("/repos/ARC/cat-photos/git/refs/heads/main")
			.reply(200, { object: { sha: "casd769adf" } });

		// Create Branch
		githubNock
			.post("/repos/ARC/cat-photos/git/refs",{
				owner: "ARC",
				repo: "cat-photos",
				ref: "refs/heads/chesire",
				sha: "casd769adf"
			})
			.reply(200);

		await GithubCreateBranchPost(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(200);
	});

	it("Should 401 without permission attributes", async () => {
		delete res.locals.githubToken;
		await GithubCreateBranchPost(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

	it.each(["owner", "repo", "sourceBranchName", "newBranchName"])("Should 400 when missing required fields", async (attribute) => {
		res.status.mockReturnValue(res);
		delete req.body[attribute];
		await GithubCreateBranchPost(req as any, res as any);
		expect(res.status).toHaveBeenCalledWith(400);
	});

	it("Should return 403 errors with URL to GitHub app settings", async () => {
		// To allow res.send().json()
		res.status.mockReturnValue(res);

		const sha = "kenshin";
		githubNock.get("/repos/ARC/cat-photos/git/refs/heads/main")
			.reply(200, { object: { sha } });
		githubNock.post("/repos/ARC/cat-photos/git/refs", {
			"owner": "ARC",
			"repo": "cat-photos",
			"ref": "refs/heads/chesire",
			"sha": sha
		}).reply(403);
		githubNock.get("/user").reply(200, { login: "ARC" });
		mocked(Subscription.findForRepoNameAndOwner).mockResolvedValue({ gitHubInstallationId, id: 1 } as Subscription);

		await GithubCreateBranchPost(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(403);
		expect(res.json).toBeCalledWith("We couldn’t create this branch, possibly because this GitHub repository hasn't been configured to your Jira site. <a href=\"omega/settings/installations/15\" target=\"_blank\">Allow access to this repository.</a>");
	});

	it("Should return 403 errors with URL to GitHub app settings for a different org", async () => {
		// To allow res.send().json()
		res.status.mockReturnValue(res);

		const sha = "himura";
		githubNock.get("/repos/ARC/cat-photos/git/refs/heads/main")
			.reply(200, { object: { sha } });
		githubNock.post("/repos/ARC/cat-photos/git/refs", {
			"owner": "ARC",
			"repo": "cat-photos",
			"ref": "refs/heads/chesire",
			"sha": sha
		}).reply(403);
		githubNock.get("/user").reply(200, { login: "samuraiX" });
		mocked(Subscription.findForRepoNameAndOwner).mockResolvedValue({ gitHubInstallationId, id: 1 } as Subscription);

		await GithubCreateBranchPost(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(403);
		expect(res.json).toBeCalledWith("We couldn’t create this branch, possibly because this GitHub repository hasn't been configured to your Jira site. <a href=\"omega/organizations/ARC/settings/installations/15\" target=\"_blank\">Allow access to this repository.</a>");
	});

});
