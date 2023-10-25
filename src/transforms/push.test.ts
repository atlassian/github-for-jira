import { enqueuePush } from "./push";
import { sqsQueues } from "../sqs/queues";
import { when } from "jest-when";
import { GitHubCommit, GitHubRepository } from "interfaces/github";
import { shouldSendAll } from "config/feature-flags";
import { getLogger } from "config/logger";

jest.mock("../sqs/queues");
jest.mock("config/feature-flags");

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
});
