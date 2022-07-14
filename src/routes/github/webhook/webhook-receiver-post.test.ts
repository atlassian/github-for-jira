import { WebhookReceiverPost } from "~/src/routes/github/webhook/webhook-receiver-post";
import { GitHubServerApp } from "models/github-server-app";
import { issueWebhookHandler } from "~/src/github/issue";
import { pushWebhookHandler } from "~/src/github/push";
import { GithubWebhookMiddleware } from "~/src/middleware/github-webhook-middleware";

jest.mock("~/src/middleware/github-webhook-middleware");

const uuid = "97da6b0e-ec61-11ec-8ea0-0242ac120002";

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
			webhookSecret: "mywebhooksecret",
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
		const mockResSendFunc = jest.fn();
		res = {
			status: jest.fn().mockReturnValue({
				send: mockResSendFunc
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
		expect(mockResSendFunc).toBeCalledWith("signature does not match event payload and secret");

	});

	it("should throw an error if signature doesn't match for GitHub cloud", async () => {
		const mockResSendFunc = jest.fn();
		res = {
			status: jest.fn().mockReturnValue({
				send: mockResSendFunc
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
		expect(mockResSendFunc).toBeCalledWith("signature does not match event payload and secret");

	});

	it("should call push handler", async () => {
		req = {
			headers: {
				"x-hub-signature-256": "sha256=a4059a1df2d84fdd1808458a7dc27efe0d63ab7309585b23fbf473c045c5aa81",
				"x-github-event": "push"
			},
			params: {
				uuid
			},
			body: {
			}
		};

		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(pushWebhookHandler);
	});


	it("should call issue handler", async () => {
		req = {
			headers: {
				"x-hub-signature-256": "sha256=b3c1c0ce21666c0349b8f3010ce81299adcc9c4ee09b904f20f712292c19b792",
				"x-github-event": "issues"
			},
			params: {
				uuid
			},
			body: {
				action: "opened"
			}
		};

		await WebhookReceiverPost(req, res);
		expect(GithubWebhookMiddleware).toBeCalledWith(issueWebhookHandler);
	});

});
