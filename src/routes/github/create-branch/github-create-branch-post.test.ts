/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { GithubCreateBranchPost } from "./github-create-branch-post";
import { getLogger } from "config/logger";

describe("delete-github-subscription", () => {
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
			sharedSecret: "shared-secret"
		});

		req = {
			log: getLogger("request"),
			params: {}
		};

		res = {
			sendStatus: jest.fn(),
			status: jest.fn(),
			json: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token",
				gitHubAppConfig: {}
			}
		};
	});

	it("Should delete GitHub Subscription as an Org admin - installation type Org | Cloud", async () => {
		req.body = {
			owner: "ARC",
			repo: "cat-photos",
			sourceBranchName: "main",
			newBranchName: "chesire"
		};

		// Get reference
		githubNock
			.get("/repos/ARC/cat-photos/git/refs/heads/main")
			.reply(200, { object: { sha: "casd769adf" } });

		// Create Branch
		githubNock
			.post("/repos/ARC/cat-photos/git/refs",{ body:
					{
						ref: "refs/heads/chesire",
						sha: "casd769adf"
					}
			})
			.reply(200);

		await GithubCreateBranchPost(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(200);
	});

});
