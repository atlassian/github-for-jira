import { enqueuePush } from "./push";
import { sqsQueues } from "../sqs/queues";
import { GitHubRepository } from "../interfaces/github";

jest.mock("../sqs/queues");

describe("Enqueue push", ()=>{
	describe("GitHub Enterprise Server", ()=>{
		it("should push GitHubAppConfig to payload", async ()=>{
			await enqueuePush({
				installation: { id: 123, node_id: 456 },
				webhookId: "wh123",
				webhookReceived: Date.now(),
				repository: {} as GitHubRepository,
				commits: [{
					id: "c123",
					message: "ARC-0001 some message"
				}]
			}, jiraHost, {
				gitHubAppId: 1,
				appId: 2,
				clientId: "clientId",
				gitHubBaseUrl: gheUrl,
				uuid: "xxx-xxx-xxx"
			});
			expect(sqsQueues.push.sendMessage).toBeCalledWith(expect.objectContaining({
				gitHubAppConfig: {
					gitHubAppId: 1,
					appId: 2,
					clientId: "clientId",
					gitHubBaseUrl: gheUrl,
					uuid: "xxx-xxx-xxx"
				}
			}));
		});
	});
});
