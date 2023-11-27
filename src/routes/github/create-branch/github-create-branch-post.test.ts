/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { GithubCreateBranchPost } from "./github-create-branch-post";
import { getLogger } from "config/logger";
import { mocked } from "jest-mock";

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

		mocked(Subscription.findForRepoOwner).mockResolvedValue({ gitHubInstallationId, id: 1 } as Subscription);
	});

	it("Should successfully run through the create branch flow", async () => {

		githubNock
			.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
			.reply(200);
		githubNock
			.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
			.reply(200);
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

		await GithubCreateBranchPost(req , res);
		expect(res.sendStatus).toHaveBeenCalledWith(200);
	});

	it.each(["owner", "repo", "sourceBranchName", "newBranchName"])("Should 400 when missing required fields", async (attribute) => {
		res.status.mockReturnValue(res);
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete req.body[attribute];
		await GithubCreateBranchPost(req , res);
		expect(res.status).toHaveBeenCalledWith(400);
	});

	it("Should return 403 errors with URL to GitHub app settings", async () => {
		// To allow res.send().json()
		res.status.mockReturnValue(res);
		githubNock
			.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
			.reply(200);
		githubNock
			.post(`/app/installations/${gitHubInstallationId}/access_tokens`)
			.reply(200);

		const sha = "kenshin";
		githubNock.get("/repos/ARC/cat-photos/git/refs/heads/main")
			.reply(200, { object: { sha } });
		githubNock.post("/repos/ARC/cat-photos/git/refs", {
			"owner": "ARC",
			"repo": "cat-photos",
			"ref": "refs/heads/chesire",
			"sha": sha
		}).reply(403);

		await GithubCreateBranchPost(req , res);

		expect(res.status).toHaveBeenCalledWith(403);
		expect(res.json).toBeCalledWith({
			error: "We couldn’t create this branch, because GitHub for Jira app does not have permission to write to the GitHub repository. If you want to enable this feature, please contact your GitHub admin to grant permission."
		});
	});

});
