import { pushWebhookHandler } from "./push";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { getLogger } from "config/logger";
import { GitHubCommit, GitHubPushData, GitHubRepository } from "../interfaces/github";
import { enqueuePush } from "../transforms/push";
import { envVars } from "config/env";
import { Subscription } from "models/subscription";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";

jest.mock("../transforms/push");

const GHES_GITHUB_INSTALLATION_ID = 1234;
const GHES_GITHUB_APP_ID = 111;
const GHES_GITHUB_UUID = "xxx-xxx-xxx-xxx";
const GHES_GITHUB_APP_APP_ID = 1;
const GHES_GITHUB_APP_CLIENT_ID = "client-id";

describe("PushWebhookHandler", ()=>{
	let jiraClient: any;
	let util: any;
	let subscription: Subscription;
	beforeEach(() => {
		jiraClient = { baseURL: jiraHost };
		util = null;
		subscription = Subscription.build({
			gitHubInstallationId: 123,
			jiraHost: jiraHost,
			jiraClientKey: "client-key"
		});
	});
	describe("GitHub Cloud", ()=>{
		it("should be called with cloud GitHubAppConfig", async ()=>{
			await pushWebhookHandler(getWebhookContext({ cloud: true }), jiraClient, util, GHES_GITHUB_INSTALLATION_ID, subscription);
			expect(enqueuePush).toBeCalledWith(expect.anything(), expect.anything(), expect.anything(), {
				uuid: undefined,
				gitHubAppId: undefined,
				appId: parseInt(envVars.APP_ID),
				clientId: envVars.GITHUB_CLIENT_ID,
				gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
				gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
			});
		});
	});
	describe("GitHub Enterprise Server", ()=>{
		it("should be called with GHES GitHubAppConfig", async ()=>{
			await pushWebhookHandler(getWebhookContext({ cloud: false }), jiraClient, util, GHES_GITHUB_INSTALLATION_ID, subscription);
			expect(enqueuePush).toBeCalledWith(expect.anything(), expect.anything(), expect.anything(), {
				uuid: GHES_GITHUB_UUID,
				gitHubAppId: GHES_GITHUB_APP_ID,
				appId: GHES_GITHUB_APP_APP_ID,
				clientId: GHES_GITHUB_APP_CLIENT_ID,
				gitHubBaseUrl: gheUrl,
				gitHubApiUrl: gheUrl
			});
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
				message: "ARC-1 some commit message",
				added: [],
				modified: [],
				removed: []
			} as unknown as GitHubCommit]
		};
		return new WebhookContext({
			id: "1",
			name: "push",
			log: getLogger("test"),
			payload,
			gitHubAppConfig: cloud ? {
				uuid: undefined,
				gitHubAppId: undefined,
				appId: parseInt(envVars.APP_ID),
				clientId: envVars.GITHUB_CLIENT_ID,
				gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
				gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
			} : {
				uuid: GHES_GITHUB_UUID,
				gitHubAppId: GHES_GITHUB_APP_ID,
				appId: GHES_GITHUB_APP_APP_ID,
				clientId: GHES_GITHUB_APP_CLIENT_ID,
				gitHubBaseUrl: gheUrl,
				gitHubApiUrl: gheUrl
			}
		});
	};
});

