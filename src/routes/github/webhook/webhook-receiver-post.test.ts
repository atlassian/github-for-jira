import { createHash, WebhookReceiverPost } from "~/src/routes/github/webhook/webhook-receiver-post";
import { GitHubServerApp } from "models/github-server-app";
import { Installation } from "models/installation";
import { issueWebhookHandler } from "~/src/github/issue";
import { pushWebhookHandler } from "~/src/github/push";
import { GithubWebhookMiddleware } from "~/src/middleware/github-webhook-middleware";
import { pullRequestWebhookHandler } from "~/src/github/pull-request";
import { createBranchWebhookHandler, deleteBranchWebhookHandler } from "~/src/github/branch";
import { repositoryWebhookHandler } from "~/src/github/repository";
import { workflowWebhookHandler } from "~/src/github/workflow";
import { deploymentWebhookHandler } from "~/src/github/deployment";
import { codeScanningAlertWebhookHandler } from "~/src/github/code-scanning-alert";
import { envVars } from "config/env";
import { GITHUB_CLOUD_API_BASEURL, GITHUB_CLOUD_BASEURL } from "~/src/github/client/github-client-constants";
import { dependabotAlertWebhookHandler } from "~/src/github/dependabot-alert";
import { Subscription } from "~/src/models/subscription";
import { DependabotAlertEvent, Schema, SecretScanningAlertEvent } from "@octokit/webhooks-types";
import { booleanFlag } from "~/src/config/feature-flags";
import { secretScanningAlertWebhookHandler } from "~/src/github/secret-scanning-alert";

jest.mock("~/src/middleware/github-webhook-middleware");
jest.mock("~/src/config/feature-flags");
jest.mock("~/src/models/subscription");

const EXIST_GHES_UUID = "97da6b0e-ec61-11ec-8ea0-0242ac120002";
const NON_EXIST_GHES_UUID = "97da6b0e-ec61-11ec-8ea0-0242ac120003";
const GHES_WEBHOOK_SECRET = "webhookSecret";
const CLOUD_WEBHOOK_SECRETS = envVars.WEBHOOK_SECRETS;

const injectRawBodyToReq = (req: any) => {
	req.rawBody = JSON.stringify(req.body);
	return req;
};

describe("webhook-receiver-post", () => {

	let req;
	let res;
	let gitHubApp: GitHubServerApp;

	const gitHubAppConfigForCloud = () => {
		return {
			gitHubAppId: undefined,
			appId: parseInt(envVars.APP_ID),
			clientId: envVars.GITHUB_CLIENT_ID,
			gitHubBaseUrl: GITHUB_CLOUD_BASEURL,
			gitHubApiUrl: GITHUB_CLOUD_API_BASEURL,
			uuid: undefined
		};
	};

	const gitHubAppConfigForGHES = () => {
		return {
			gitHubAppId: gitHubApp.id,
			appId: gitHubApp.appId,
			clientId: gitHubApp.gitHubClientId,
			gitHubBaseUrl: gitHubApp.gitHubBaseUrl,
			gitHubApiUrl: gitHubApp.gitHubBaseUrl,
			uuid: gitHubApp.uuid
		};
	};

	beforeEach(async () => {
		res = {
			status: jest.fn().mockReturnValue({
				send: jest.fn()
			}),
			sendStatus: jest.fn()
		};

		const installation = await Installation.install({
			clientKey: "clientKey123",
			host: jiraHost,
			sharedSecret: "secrete123"
		});

		const payload = {
			uuid: EXIST_GHES_UUID,
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: GHES_WEBHOOK_SECRET,
			privateKey: "myprivatekey",
			installationId: installation.id
		};
		gitHubApp = await GitHubServerApp.install(payload, jiraHost);


	});

	it("should throw an error if github app not found", async () => {
		req = createGHESReqForEvent("push", "", NON_EXIST_GHES_UUID);

		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(res.sendStatus).toBeCalledWith(400);

	});

	it("should throw an error if signature doesn't match for GHE app", async () => {
		req = createReqWithInvalidSignature("push", EXIST_GHES_UUID);

		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(res.status).toBeCalledWith(400);
		expect(res.status().send).toBeCalledWith("signature does not match event payload and secret");

	});

	it("should throw an error if signature doesn't match for GitHub cloud", async () => {
		req = createReqWithInvalidSignature("push", undefined);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(res.status).toBeCalledWith(400);
		expect(res.status().send).toBeCalledWith("signature does not match event payload and secret");

	});

	describe("Pulling cloud or GHES app config", () => {
		it("should pull cloud gitHubAppConfig with undefined UUID", async () => {
			req = createCloudReqForEvent("push");
			const spy = jest.fn();
			jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
			await WebhookReceiverPost(injectRawBodyToReq(req), res);
			expect(GithubWebhookMiddleware).toBeCalledWith(pushWebhookHandler);
			expect(spy).toBeCalledWith(expect.objectContaining({
				id: "100",
				name: "push",
				gitHubAppConfig: gitHubAppConfigForCloud()
			}));
		});
		it("should pull cloud gitHubAppConfig with undefined UUID when using old webhook secrets", async () => {
			req = createCloudReqForEventWithOldWebhookSecret("push");
			const spy = jest.fn();
			jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
			await WebhookReceiverPost(injectRawBodyToReq(req), res);
			expect(GithubWebhookMiddleware).toBeCalledWith(pushWebhookHandler);
			expect(spy).toBeCalledWith(expect.objectContaining({
				id: "100",
				name: "push",
				gitHubAppConfig: gitHubAppConfigForCloud()
			}));
		});
		it("should not pull cloud gitHubAppConfig with undefined UUID when using random webhook secrets", async () => {
			req = createCloudReqForEventWithRandomWebhookSecret("push");
			const spy = jest.fn();
			jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
			await WebhookReceiverPost(injectRawBodyToReq(req), res);
			expect(res.status).toBeCalledWith(400);
			expect(res.status().send).toBeCalledWith("signature does not match event payload and secret");
		});
		it("should pull GHES gitHubAppConfig with valid GHES UUID", async () => {
			req = createGHESReqForEvent("push", "", EXIST_GHES_UUID);
			const spy = jest.fn();
			jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
			await WebhookReceiverPost(injectRawBodyToReq(req), res);
			expect(GithubWebhookMiddleware).toBeCalledWith(pushWebhookHandler);
			expect(spy).toBeCalledWith(expect.objectContaining({
				id: "100",
				name: "push",
				gitHubAppConfig: gitHubAppConfigForGHES()
			}));
		});
	});

	it("should call push handler", async () => {
		req = createGHESReqForEvent("push", "", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(pushWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "push",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});


	it("should call issue handler", async () => {
		req = createGHESReqForEvent("issues", "opened", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(issueWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "issues",
			action: "opened",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

	it("should call pull handler", async () => {
		req = createGHESReqForEvent("pull_request", "opened", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(pullRequestWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "pull_request",
			action: "opened",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

	it("should call pull request review handler", async () => {
		req = createGHESReqForEvent("pull_request_review", "", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(pullRequestWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "pull_request_review",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

	it("should call create branch handler", async () => {
		req = createGHESReqForEvent("create", "", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(createBranchWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "create",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

	it("should call delete branch handler", async () => {
		req = createGHESReqForEvent("delete", "", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(deleteBranchWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "delete",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

	it("should call delete repository handler", async () => {
		req = createGHESReqForEvent("repository", "deleted", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(repositoryWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "repository",
			action: "deleted",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

	it("should call created repository handler", async () => {
		req = createGHESReqForEvent("repository", "created", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(repositoryWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "repository",
			action: "created",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

	it("should call workflow handler", async () => {
		req = createGHESReqForEvent("workflow_run", "", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(workflowWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "workflow_run",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

	it("should call deployment handler", async () => {
		req = createGHESReqForEvent("deployment_status", "", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(deploymentWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "deployment_status",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

	it("should call code scanning handler", async () => {
		req = createGHESReqForEvent("code_scanning_alert", "", EXIST_GHES_UUID);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(codeScanningAlertWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "code_scanning_alert",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});
	it("should not call dependabot handler when ENABLE_GITHUB_SECURITY_IN_JIRA is disabled", async () => {
		req = createGHESReqForEvent("dependabot_alert", "", EXIST_GHES_UUID, { installation: { id: 123 } } as unknown as DependabotAlertEvent);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		jest.mocked(booleanFlag).mockReturnValue(Promise.resolve(false));
		jest.mocked(Subscription.findOneForGitHubInstallationId).mockReturnValue(Promise.resolve({ jiraHost: "https://test-instnace.atlassian.net" } as unknown as Subscription));
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).not.toBeCalledWith(dependabotAlertWebhookHandler);
	});
	it("should call dependabot handler", async () => {
		req = createGHESReqForEvent("dependabot_alert", "", EXIST_GHES_UUID, { installation: { id: 123 } } as unknown as DependabotAlertEvent);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		jest.mocked(booleanFlag).mockReturnValue(Promise.resolve(true));
		jest.mocked(Subscription.findOneForGitHubInstallationId).mockReturnValue(Promise.resolve({ jiraHost: "https://test-instnace.atlassian.net" } as unknown as Subscription));
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(dependabotAlertWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "dependabot_alert",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});
	it("should not call secret scanning handler when ENABLE_GITHUB_SECURITY_IN_JIRA is disabled", async () => {
		req = createGHESReqForEvent("secret_scanning_alert", "", EXIST_GHES_UUID, { installation: { id: 123 } } as unknown as SecretScanningAlertEvent);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		jest.mocked(booleanFlag).mockReturnValue(Promise.resolve(false));
		jest.mocked(Subscription.findOneForGitHubInstallationId).mockReturnValue(Promise.resolve({ jiraHost: "https://test-instnace.atlassian.net" } as unknown as Subscription));
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).not.toBeCalledWith(secretScanningAlertWebhookHandler);
	});
	it("should call secret scanning handler", async () => {
		req = createGHESReqForEvent("secret_scanning_alert", "", EXIST_GHES_UUID, { installation: { id: 123 } } as unknown as SecretScanningAlertEvent);
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		jest.mocked(booleanFlag).mockReturnValue(Promise.resolve(true));
		jest.mocked(Subscription.findOneForGitHubInstallationId).mockReturnValue(Promise.resolve({ jiraHost: "https://test-instnace.atlassian.net" } as unknown as Subscription));
		await WebhookReceiverPost(injectRawBodyToReq(req), res);
		expect(GithubWebhookMiddleware).toBeCalledWith(secretScanningAlertWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "secret_scanning_alert",
			gitHubAppConfig: gitHubAppConfigForGHES()
		}));
	});

});

describe("createHash", () => {
	it("throws a Error if no data was provided", () => {
		expect(() => createHash(undefined, "blah")).toThrow();
	});
});

const createReqWithInvalidSignature = (event: string, uuid?: string) => {
	return createReqForEvent({ event, uuid, signature: "invalid-signature" });
};

const createCloudReqForEvent = (event: string, action?: string) => {
	return createReqForEvent({
		event, action, webhookSecret: CLOUD_WEBHOOK_SECRETS[0]
	});
};

const createCloudReqForEventWithOldWebhookSecret = (event: string, action?: string) => {
	return createReqForEvent({
		event, action, webhookSecret: CLOUD_WEBHOOK_SECRETS[1]
	});
};
const createCloudReqForEventWithRandomWebhookSecret = (event: string, action?: string) => {
	return createReqForEvent({
		event, action, webhookSecret: "XX-random-string-XX"
	});
};

const createGHESReqForEvent = (event: string, action?: string, uuid?: string, payload?: Schema) => {
	return createReqForEvent({
		event, action, uuid, webhookSecret: GHES_WEBHOOK_SECRET, payload
	});
};

const createReqForEvent = (
	{ event, action, uuid, webhookSecret, signature, payload }:
		{ event: string, action?: string, uuid?: string, webhookSecret?: string, signature?: string, payload?: Schema }
) => {
	const body = action ? { action, ...payload } : { ...payload };

	const req = {
		headers: {
			"x-hub-signature-256": signature || createHash(JSON.stringify(body), webhookSecret || ""),
			"x-github-event": event,
			"x-github-delivery": "100"
		},
		params: {
			uuid
		},
		body
	};
	return req;
};
