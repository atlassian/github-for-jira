import { enqueuePush, processPush } from "./push";
import { sqsQueues } from "../sqs/queues";
import { when } from "jest-when";
import { GitHubCommit, GitHubRepository } from "interfaces/github";
import { shouldSendAll, booleanFlag, BooleanFlags } from "config/feature-flags";
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "../github/client/github-installation-client";
import { DatabaseStateCreator, CreatorResult } from "test/utils/database-state-creator";

jest.mock("../sqs/queues");
jest.mock("config/feature-flags");
const logger = getLogger("test");

describe("Enqueue push", () => {
	it("should push GitHubAppConfig to payload", async () => {
		await enqueuePush({
			installation: { id: 123, node_id: 456 },
			webhookId: "wh123",
			webhookReceived: Date.now(),
			repository: {} as GitHubRepository,
			commits: [{
				id: "c123",
				message: "ARC-1 some message",
				added: [],
				modified: [],
				removed: []
			} as unknown as GitHubCommit]
		}, jiraHost, getLogger("test"), {
			gitHubAppId: 1,
			appId: 2,
			clientId: "clientId",
			gitHubBaseUrl: "https://whatever.url",
			gitHubApiUrl: "https://api.whatever.url",
			uuid: "xxx-xxx-xxx"
		});

		expect(sqsQueues.push.sendMessage).toBeCalledWith(expect.objectContaining({
			shas: [
				{ id: "c123", issueKeys: ["ARC-1"] }
			],
			gitHubAppConfig: {
				gitHubAppId: 1,
				appId: 2,
				clientId: "clientId",
				gitHubBaseUrl: "https://whatever.url",
				gitHubApiUrl: "https://api.whatever.url",
				uuid: "xxx-xxx-xxx"
			}
		}), 0, expect.anything());
	});

	it("should push shas with no issue keys", async () => {
		when(shouldSendAll).calledWith("commits", expect.anything(), expect.anything()).mockResolvedValue(true);
		await enqueuePush({
			installation: { id: 123, node_id: 456 },
			webhookId: "wh123",
			webhookReceived: Date.now(),
			repository: {} as GitHubRepository,
			commits: [{
				id: "c123",
				message: "some message",
				added: [],
				modified: [],
				removed: []
			} as unknown as GitHubCommit]
		}, jiraHost, getLogger("test"), {
			gitHubAppId: 1,
			appId: 2,
			clientId: "clientId",
			gitHubBaseUrl: "https://whatever.url",
			gitHubApiUrl: "https://api.whatever.url",
			uuid: "xxx-xxx-xxx"
		});
		expect(sqsQueues.push.sendMessage).toBeCalledWith(expect.objectContaining({
			shas: [
				{ id: "c123", issueKeys: [] }
			]
		}), 0, expect.anything());
	});

	it("should not push shas with no issue keys", async () => {
		when(shouldSendAll).calledWith("commits", expect.anything(), expect.anything()).mockResolvedValue(false);
		await enqueuePush({
			installation: { id: 123, node_id: 456 },
			webhookId: "wh123",
			webhookReceived: Date.now(),
			repository: {} as GitHubRepository,
			commits: [{
				id: "c123",
				message: "some message",
				added: [],
				modified: [],
				removed: []
			} as unknown as GitHubCommit]
		}, jiraHost, getLogger("test"), {
			gitHubAppId: 1,
			appId: 2,
			clientId: "clientId",
			gitHubBaseUrl: "https://whatever.url",
			gitHubApiUrl: "https://api.whatever.url",
			uuid: "xxx-xxx-xxx"
		});
		expect(sqsQueues.push.sendMessage).toBeCalledWith(expect.objectContaining({
			shas: []
		}), 0, expect.anything());
	});

	describe.only("Skipping msg when issue not exist", () => {

		let db: CreatorResult;
		beforeEach(async () => {
			db = await new DatabaseStateCreator()
				.forCloud()
				.create();
			when(shouldSendAll).calledWith("commits", expect.anything(), expect.anything()).mockResolvedValue(false);
		});

		it("should NOT process issue if skip ff is on and the issue keys is not valid", async () => {

			when(booleanFlag).calledWith(BooleanFlags.SKIP_PROCESS_QUEUE_IF_ISSUE_NOT_FOUND, expect.anything())
				.mockResolvedValue(true);

			mockIssueNotExists("ABC-111");

			await processPush(getGitHubClient(), getPushPayload("sha-111", [ "ABC-111" ]), logger);

		});

		it("should process issue if skip ff is on and the issue keys is valid", async () => {

			when(booleanFlag).calledWith(BooleanFlags.SKIP_PROCESS_QUEUE_IF_ISSUE_NOT_FOUND, expect.anything())
				.mockResolvedValue(true);

			mockIssueExists("ABC-222");

			githubUserTokenNock(db.subscription.gitHubInstallationId);
			mockGitHubCommitRestApi("sha-222");

			mockJiraDevInfoAcceptUpdate("ABC-222");

			await processPush(getGitHubClient(), getPushPayload("sha-222", [ "ABC-222" ]), logger);

		});

		it("should process issue if skip ff is off and the issue keys is not valid", async () => {

			when(booleanFlag).calledWith(BooleanFlags.SKIP_PROCESS_QUEUE_IF_ISSUE_NOT_FOUND, expect.anything())
				.mockResolvedValue(false);

			githubUserTokenNock(db.subscription.gitHubInstallationId);
			mockGitHubCommitRestApi("sha-333");

			mockJiraDevInfoAcceptUpdate("ABC-333");

			await processPush(getGitHubClient(), getPushPayload("sha-333", [ "ABC-333" ]), logger);

		});

		const mockJiraDevInfoAcceptUpdate = (...issueKeys) => {
			jiraNock.post("/rest/devinfo/0.10/bulk", (reqBody) => {
				return reqBody.repositories[0].commits.flatMap(c => c.issueKeys).some(ck => issueKeys.includes(ck));
			}).reply(202, "");
		};

		const mockGitHubCommitRestApi = (sha) => {
			githubNock
				.get("/repos/org1/repo1/commits/" + sha)
				.reply(200, {
					files: [],
					sha
				});
		};

		const getPushPayload = (sha, issueKeys: string[]) => {
			return {
				jiraHost,
				installationId: db.subscription.gitHubInstallationId,
				gitHubAppConfig: undefined,
				webhookId: "aaa",
				repository: {
					owner: { login: "org1" },
					name: "repo1"
				} as GitHubRepository,
				shas: [{
					id: sha,
					issueKeys: [...issueKeys]
				}]
			};
		};

		const mockIssueExists = (...issueKeys) => {
			issueKeys.forEach(k => {
				jiraNock.get(`/rest/api/latest/issue/${k}`)
					.query({ fields: "summary" }).reply(200, {});
			});
		};

		const mockIssueNotExists = (...issueKeys) => {
			issueKeys.forEach(k => {
				jiraNock.get(`/rest/api/latest/issue/${k}`)
					.query({ fields: "summary" }).reply(404, "");
			});
		};

		const getGitHubClient = () => {
			return new GitHubInstallationClient({
				appId: 2,
				githubBaseUrl: "https://api.github.com",
				installationId: db.subscription.gitHubInstallationId
			}, {
				apiUrl: "https://api.github.com",
				baseUrl: "https://github.com",
				graphqlUrl: "https://api.github.com/graphql",
				hostname: "https://github.com",
				apiKeyConfig: undefined,
				proxyBaseUrl: undefined
			}, jiraHost, { trigger: "test" }, logger, undefined);
		};
	});

});
