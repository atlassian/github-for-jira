/* eslint-disable @typescript-eslint/no-explicit-any */
import { Subscription } from "models/subscription";
import { GithubSubscriptionGet } from "routes/github/subscription/github-subscription-get";

const createGitHubNockGet = (url, status, response) => {
	githubNock
		.get(url)
		.reply(status, response);
};

describe("github-subscription-get", () => {
	const gitHubInstallationId = 15;
	const jiraHost = "mock-host";
	let req, res, next;

	beforeEach(async () => {
		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		next = jest.fn();

		req = {
			log: { child:() => ({ error: jest.fn(), info: jest.fn(), debug: jest.fn() }) },
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

	it("Should get GitHub Subscriptions", async () => {

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
			locals: {}
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

	it("Should throw an error when GitHub app IDs do not match", async () => {
		res.locals.gitHubAppConfig.gitHubAppId = "97da6b0e-ec61-11ec-8ea0-0242ac120002";

		await expect(GithubSubscriptionGet(req as any, res as any, next as any))
			.rejects
			.toThrow("Cannot GET subscription.");
	});
});
