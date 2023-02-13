import { createBranchWebhookHandler, deleteBranchWebhookHandler } from "./branch";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { getLogger } from "config/logger";
import { GITHUB_CLOUD_BASEURL, GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";
import { envVars } from "config/env";
import { sqsQueues } from "../sqs/queues";

jest.mock("../sqs/queues");

const GITHUB_INSTALLATION_ID = 1234;
const GHES_GITHUB_APP_ID = 111;
const GHES_GITHUB_UUID = "xxx-xxx-xxx-xxx";
const GHES_GITHUB_APP_APP_ID = 1;
const GHES_GITHUB_APP_CLIENT_ID = "client-id";

describe("BranchhWebhookHandler", () => {
	let jiraClient: { baseURL: string };
	beforeEach(() => {
		jiraClient = { baseURL: jiraHost };
	});
	describe("GitHub Cloud", () => {
		it("should be called with cloud GitHubAppConfig", async () => {
			await createBranchWebhookHandler(getWebhookContext({ cloud: true }), jiraClient, undefined, GITHUB_INSTALLATION_ID);
			expect(sqsQueues.branch.sendMessage).toBeCalledWith(expect.objectContaining({
				gitHubAppConfig: {
					uuid: undefined,
					gitHubAppId: undefined,
					appId: parseInt(envVars.APP_ID),
					clientId: envVars.GITHUB_CLIENT_ID,
					gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
					gitHubApiUrl: GITHUB_CLOUD_API_BASEURL
				}
			}));
		});
	});
	describe("GitHub Enterprise Server", () => {

		it("should be called with GHES GitHubAppConfig", async () => {
			await createBranchWebhookHandler(getWebhookContext({ cloud: false }), jiraClient, undefined, GITHUB_INSTALLATION_ID);
			expect(sqsQueues.branch.sendMessage).toBeCalledWith(expect.objectContaining({
				gitHubAppConfig: {
					uuid: GHES_GITHUB_UUID,
					gitHubAppId: GHES_GITHUB_APP_ID,
					appId: GHES_GITHUB_APP_APP_ID,
					clientId: GHES_GITHUB_APP_CLIENT_ID,
					gitHubBaseUrl: gheUrl,
					gitHubApiUrl: gheUrl
				}
			}));
		});

		describe("deleteBranchWebhookHandler", () => {
			it("should transform repo id", async () => {
				const jiraClient = {
					devinfo: {
						branch: {
							delete: jest.fn()
						}
					}
				};
				await deleteBranchWebhookHandler(getWebhookContext({ cloud: false }), jiraClient);
				const caughtTransformedRepositoryId = jiraClient.devinfo.branch.delete.mock.calls[0][0];
				expect(caughtTransformedRepositoryId).toEqual("6769746875626d79646f6d61696e636f6d-1");
			});
		});
	});
	const getWebhookContext = ({ cloud }: {cloud: boolean}) => {
		return new WebhookContext({
			id: "1",
			name: "create",
			log: getLogger("test"),
			payload: {
				repository: {
					id: 1
				},
				ref: "TEST-1"
			},
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

