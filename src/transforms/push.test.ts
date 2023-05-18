import { enqueuePush } from "./push";
import { sqsQueues } from "../sqs/queues";
import { GitHubCommit, GitHubRepository } from "interfaces/github";

jest.mock("../sqs/queues");

describe("Enqueue push", () => {
	it("should push GitHubAppConfig to payload", async () => {
		await enqueuePush({
			installation: { id: 123, node_id: 456 },
			webhookId: "wh123",
			webhookReceived: Date.now(),
			repository: {} as GitHubRepository,
			commits: [{
				id: "c123",
				message: "ARC-0001 some message",
				added: [],
				modified: [],
				removed: []
			} as unknown as GitHubCommit]
		}, jiraHost, {
			gitHubAppId: 1,
			appId: 2,
			clientId: "clientId",
			gitHubBaseUrl: "https://whatever.url",
			gitHubApiUrl: "https://api.whatever.url",
			uuid: "xxx-xxx-xxx"
		});
		expect(sqsQueues.push.sendMessage).toBeCalledWith(expect.objectContaining({
			gitHubAppConfig: {
				gitHubAppId: 1,
				appId: 2,
				clientId: "clientId",
				gitHubBaseUrl: "https://whatever.url",
				gitHubApiUrl: "https://api.whatever.url",
				uuid: "xxx-xxx-xxx"
			}
		}));
	});
	describe("Detecting user config files", () => {
		const commitFile = (filename: string) => ({ filename });
		it("should set shouldUpdateUserConfigFile to true if file added", async () => {
			await enqueuePush({
				installation: { id: 123, node_id: 456 }, webhookId: "wh123", webhookReceived: Date.now(), repository: {} as GitHubRepository,
				commits: [{ id: "c123", message: "ARC-0001 some message",
					added: [commitFile(".jira/config.yml"), commitFile("blah/blah/other.txt")],
					modified: [],
					removed: []
				} as unknown as GitHubCommit]
			}, jiraHost, {
				appId: 2, clientId: "clientId", gitHubAppId: undefined, uuid: undefined,
				gitHubBaseUrl: "https://whatever.url", gitHubApiUrl: "https://api.whatever.url"
			});
			expect(sqsQueues.push.sendMessage).toBeCalledWith(expect.objectContaining({
				shouldUpdateUserConfigFile: true
			}));
		});
		it("should set shouldUpdateUserConfigFile to true if file modified", async () => {
			await enqueuePush({
				installation: { id: 123, node_id: 456 }, webhookId: "wh123", webhookReceived: Date.now(), repository: {} as GitHubRepository,
				commits: [{ id: "c123", message: "ARC-0001 some message",
					added: [],
					modified: [commitFile(".jira/config.yml"), commitFile("blah/blah/other.txt")],
					removed: []
				} as unknown as GitHubCommit]
			}, jiraHost, {
				appId: 2, clientId: "clientId", gitHubAppId: undefined, uuid: undefined,
				gitHubBaseUrl: "https://whatever.url", gitHubApiUrl: "https://api.whatever.url"
			});
			expect(sqsQueues.push.sendMessage).toBeCalledWith(expect.objectContaining({
				shouldUpdateUserConfigFile: true
			}));
		});
		it("should NOT shouldUpdateUserConfigFile if file present", async () => {
			await enqueuePush({
				installation: { id: 123, node_id: 456 }, webhookId: "wh123", webhookReceived: Date.now(), repository: {} as GitHubRepository,
				commits: [{ id: "c123", message: "ARC-0001 some message",
					added: [commitFile(".other/config.yml"), commitFile("./blah/blah/other.txt")],
					modified: [commitFile(".other/config.yml"), commitFile("./blah/blah/other.txt")],
					removed: []
				} as unknown as GitHubCommit]
			}, jiraHost, {
				appId: 2, clientId: "clientId", gitHubAppId: undefined, uuid: undefined,
				gitHubBaseUrl: "https://whatever.url", gitHubApiUrl: "https://api.whatever.url"
			});
			expect(sqsQueues.push.sendMessage).toBeCalledWith(expect.objectContaining({
				shouldUpdateUserConfigFile: false
			}));
		});
	});
});
