import { pushWebhookHandler } from "./push";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { getLogger } from "config/logger";
import { GitHubPushData, GitHubRepository } from "../interfaces/github";
import { enqueuePush } from "../transforms/push";

jest.mock("../transforms/push");

const GHES_GITHUB_INSTALLATION_ID = 1234;
const GHES_GITHUB_APP_ID = 111;
const GHES_GITHUB_UUID = "xxx-xxx-xxx-xxx";
const GHES_GITHUB_APP_APP_ID = 1;
const GHES_GITHUB_APP_CLIENT_ID = "client-id";

describe("PushWebhookHandler", ()=>{
	let jiraClient: any;
	let util: any;
	beforeEach(() => {
		jiraClient = { baseURL: jiraHost };
		util = null;
	});
	describe("GitHub Cloud", ()=>{
		it("should be called WITHOUT GitHubAppConfig", async ()=>{
			await pushWebhookHandler(getWebhookContext({ cloud: true }), jiraClient, util, GHES_GITHUB_INSTALLATION_ID);
			expect(enqueuePush).toBeCalledWith(expect.anything(), expect.anything(), undefined);
		});
	});
	describe("GitHub Enterprise Server", ()=>{
		it("should be called WITH GitHubAppConfig", async ()=>{
			await pushWebhookHandler(getWebhookContext({ cloud: false }), jiraClient, util, GHES_GITHUB_INSTALLATION_ID);
			expect(enqueuePush).toBeCalledWith(expect.anything(), expect.anything(), expect.objectContaining({
				uuid: GHES_GITHUB_UUID,
				gitHubAppId: GHES_GITHUB_APP_ID,
				appId: GHES_GITHUB_APP_APP_ID,
				clientId: GHES_GITHUB_APP_CLIENT_ID,
				gitHubBaseUrl: gheUrl
			}));
		});
	});
	const getWebhookContext = ({ cloud }: {cloud: boolean}) => {
		const payload: GitHubPushData = {
			installation: {
				id: GHES_GITHUB_INSTALLATION_ID,
				node_id: 123
			},
			webhookId: "aaa-bbb-ccc",
			webhookReceived: Date.now(),
			repository: {} as GitHubRepository, //force it as not required in test
			commits: [{
				id: "commit-1",
				message: "ARC-0001 some commit message"
			}]
		};
		return new WebhookContext({
			id: "1",
			name: "push",
			log: getLogger("test"),
			payload,
			gitHubAppConfig: cloud ? undefined : {
				uuid: GHES_GITHUB_UUID,
				gitHubAppId: GHES_GITHUB_APP_ID,
				appId: GHES_GITHUB_APP_APP_ID,
				clientId: GHES_GITHUB_APP_CLIENT_ID,
				gitHubBaseUrl: gheUrl
			}
		});
	};
});

