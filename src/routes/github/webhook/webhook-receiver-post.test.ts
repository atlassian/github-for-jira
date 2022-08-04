import { createHash, WebhookReceiverPost } from "~/src/routes/github/webhook/webhook-receiver-post";
import { GitHubServerApp } from "models/github-server-app";
import { issueWebhookHandler } from "~/src/github/issue";
import { pushWebhookHandler } from "~/src/github/push";
import { GithubWebhookMiddleware } from "~/src/middleware/github-webhook-middleware";
import { pullRequestWebhookHandler } from "~/src/github/pull-request";
import { createBranchWebhookHandler, deleteBranchWebhookHandler } from "~/src/github/branch";
import { deleteRepository } from "~/src/github/repository";
import { workflowWebhookHandler } from "~/src/github/workflow";
import { deploymentWebhookHandler } from "~/src/github/deployment";
import { codeScanningAlertWebhookHandler } from "~/src/github/code-scanning-alert";

jest.mock("~/src/middleware/github-webhook-middleware");

const uuid = "97da6b0e-ec61-11ec-8ea0-0242ac120002";
const webhookSeret = "webhookSecret";

describe("webhook-receiver-post", () => {

	let req;
	let res;

	beforeEach(async () => {
		res = {
			status: jest.fn().mockReturnValue({
				send: jest.fn()
			}),
			sendStatus: jest.fn()
		};

		const payload = {
			uuid,
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://myinternalserver.com",
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: webhookSeret,
			privateKey: "myprivatekey",
			installationId: 10
		};
		await GitHubServerApp.install(payload);
	});

	it("should throw an error if github app not found", async () => {
		res = {
			sendStatus: jest.fn()
		};
		req = {
			headers: {},
			params: {
				uuid: "97da6b0e-ec61-11ec-8ea0-0242ac120007"
			}
		};

		await WebhookReceiverPost(req, res);
		expect(res.sendStatus).toBeCalledWith(400);

	});

	it("should throw an error if signature doesn't match for GHE app", async () => {
		res = {
			status: jest.fn().mockReturnValue({
				send: jest.fn()
			})
		};
		req = {
			headers: {
				"x-hub-signature-256": "signature123"
			},
			params: {
				uuid
			},
			body: {}
		};

		await WebhookReceiverPost(req, res);
		expect(res.status).toBeCalledWith(400);
		expect(res.status().send).toBeCalledWith("signature does not match event payload and secret");

	});

	it("should throw an error if signature doesn't match for GitHub cloud", async () => {
		res = {
			status: jest.fn().mockReturnValue({
				send: jest.fn()
			})
		};
		req = {
			headers: {
				"x-hub-signature-256": "signature123"
			},
			params: {
			},
			body: {}
		};

		await WebhookReceiverPost(req, res);
		expect(res.status).toBeCalledWith(400);
		expect(res.status().send).toBeCalledWith("signature does not match event payload and secret");

	});

	it("should call push handler", async () => {
		req = createReqForEvent("push");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(pushWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "push"
		}));
	});


	it("should call issue handler", async () => {
		req = createReqForEvent("issues", "opened");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(issueWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "issues",
			action: "opened"
		}));
	});

	it("should call pull handler", async () => {
		req = createReqForEvent("pull_request", "opened");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(pullRequestWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "pull_request",
			action: "opened"
		}));
	});

	it("should call pull request review handler", async () => {
		req = createReqForEvent("pull_request_review");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(pullRequestWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "pull_request_review"
		}));
	});

	it("should call create branch handler", async () => {
		req = createReqForEvent("create");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(createBranchWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "create"
		}));
	});

	it("should call delete branch handler", async () => {
		req = createReqForEvent("delete");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(deleteBranchWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "delete"
		}));
	});

	it("should call delete repository handler", async () => {
		req = createReqForEvent("repository", "deleted");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(deleteRepository);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "repository",
			action: "deleted"
		}));
	});

	it("should call workflow handler", async () => {
		req = createReqForEvent("workflow_run");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(workflowWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "workflow_run"
		}));
	});

	it("should call deployment handler", async () => {
		req = createReqForEvent("deployment_status");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(deploymentWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "deployment_status"
		}));
	});

	it("should call code scanning handler", async () => {
		req = createReqForEvent("code_scanning_alert");
		const spy = jest.fn();
		jest.mocked(GithubWebhookMiddleware).mockImplementation(() => spy);
		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(codeScanningAlertWebhookHandler);
		expect(spy).toBeCalledWith(expect.objectContaining({
			id: "100",
			name: "code_scanning_alert"
		}));
	});

});

const createReqForEvent = (event: string, action?: string) => {
	const body = action ? { action } : {};

	const req = {
		headers: {
			"x-hub-signature-256": createHash(JSON.stringify(body), webhookSeret),
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