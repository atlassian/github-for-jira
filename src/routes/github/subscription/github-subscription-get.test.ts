/* eslint-disable @typescript-eslint/no-explicit-any */
import { Subscription } from "models/subscription";
import { GithubSubscriptionGet } from "routes/github/subscription/github-subscription-get";
import { when } from "jest-when";
import { GitHubServerApp } from "models/github-server-app";
import { getLogger } from "config/logger";

jest.mock("models/github-server-app");

const createGitHubNockGet = (url, status, response) => {
	githubNock
		.get(url)
		.reply(status, response);
};

describe("github-subscription-get", () => {
	const gitHubInstallationId = 15;
	const jiraHost = "mock-host";
	let req, res, next, gitHubApp;

	beforeEach(async () => {
		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		next = jest.fn();

		req = {
			log: getLogger("test"),
			params: {
				installationId: gitHubInstallationId
			},
			csrfToken: jest.fn(),
			body: {}
		};

		res = {
			render: jest.fn(),
			sendStatus: jest.fn(),
			status: jest.fn(),
			json: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token",
				isAdmin: jest.fn().mockResolvedValue(true),
				nonce: "",
				gitHubAppConfig: {}
			}
		};
	});

	it("Should get GitHub Subscriptions | Cloud", async () => {

		const installation = {
			target_type: "Org", account: { login: "test-org" }
		};
		createGitHubNockGet("/user", 200, { login: "test-org" });

		createGitHubNockGet("/app/installations/15", 200, installation);

		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "admin", user: { login: "test-org" }
		});

		await GithubSubscriptionGet(req as any, res as any, next as any);

		expect(res.render).toHaveBeenCalledWith("github-subscriptions.hbs", expect.objectContaining({
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			installation,
			host: res.locals.jiraHost,
			hasSubscriptions: true
		}));
	});

	it("Should get GitHub Subscriptions | Server", async () => {
		const gitHubAppId = 1;
		res.locals.gitHubAppConfig.gitHubAppId = 1;
		res.locals.gitHubAppConfig.uuid = uuid;

		gitHubApp = {
			id: gitHubAppId,
			uuid,
			appId: 1,
			gitHubAppName: "my awesome app1",
			gitHubBaseUrl: "http://myinternalinstance.com",
			gitHubClientId: "lvl.1n23j12389wndd",
			gitHubClientSecret: "secret1",
			webhookSecret: "anothersecret1",
			privateKey: "privatekey1",
			installationId: 1,
			decrypt: async (s: any) => s
		};

		await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			gitHubAppId
		});

		when(GitHubServerApp.findForUuid)
			.expectCalledWith(uuid)
			.mockResolvedValue(gitHubApp);

		const installation = {
			target_type: "Org", account: { login: "test-org" }
		};
		createGitHubNockGet("/user", 200, { login: "test-org" });

		createGitHubNockGet("/app/installations/15", 200, installation);

		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "admin", user: { login: "test-org" }
		});

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(res.render).toHaveBeenCalledWith("github-subscriptions.hbs", expect.objectContaining({
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			installation,
			host: res.locals.jiraHost,
			hasSubscriptions: true,
			gitHubAppUuid: uuid
		}));
	});

	it("Should throw Unauthorized Error when login fails access test", async () => {

		res.locals.isAdmin = jest.fn().mockResolvedValue(false);

		createGitHubNockGet("/user", 200, { login: "test-org" });

		createGitHubNockGet("/app/installations/15", 200, {
			target_type: "Org", account: { login: "test-org" }
		});

		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "notadmin", user: { login: "test-org" }
		});

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("Unauthorized"));
	});

	it("Should return Error inside Next when error is thrown inside try block", async () => {
		res.locals.isAdmin = jest.fn().mockRejectedValue(new Error("Whoops"));

		createGitHubNockGet("/user", 200, { login: "test-org" });

		createGitHubNockGet("/app/installations/15", 200, {
			target_type: "Org", account: { login: "test-org" }
		});

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("Unable to show subscription page"));
	});

	it("Should return Unauthorized inside Next when missing githubToken", async () => {

		res = {
			sendStatus: jest.fn(),
			locals: {
				gitHubAppConfig: {}
			}
		};

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("Unauthorized"));
	});

	it("Should return Error inside Next when missing installationId", async () => {
		delete req.params["installationId"];

		res.status.mockReturnValue(res);

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("installationId and jiraHost must be provided to delete a subscription."));
	});

	it("Should return Error inside Next when missing jirahost", async () => {
		delete res.locals["jiraHost"];

		res.status.mockReturnValue(res);

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("installationId and jiraHost must be provided to delete a subscription."));
	});
});
