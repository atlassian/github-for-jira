/* eslint-disable @typescript-eslint/no-explicit-any */
import { Subscription } from "models/index";
import { GithubSubscriptionGet } from "routes/github/subscription/github-subscription-get";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

const createGitHubNockGet = (url, status, response) => {
	githubNock
		.get(url)
		.reply(status, response);
};

describe.skip("github-subscription-get", () => {
	const gitHubInstallationId = 15;
	const jiraHost = "mock-host";
	let req, res, next;

	beforeEach(async () => {
		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_GET_SUBSCRIPTION,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);

		next = jest.fn();

		req = {
			log: { child:() => ({ error: jest.fn(), info: jest.fn()}) },
			params: {
				installationId: gitHubInstallationId
			},
			csrfToken: jest.fn()
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
				nonce: ""
			}
		};

	});

	it("Should get GitHub Subscriptions", async () => {
		
		const installation = {
			target_type: "Org", account: { login: "test-org" }
		};
	
		createGitHubNockGet("/user", 200, { login: "test-org" });

		createGitHubNockGet("/app/installations/15", 200, installation);

		createGitHubNockGet("/app/installations", 200, { things: "stuff" });

		await GithubSubscriptionGet(req as any, res as any, next as any);

		expect(res.render).toHaveBeenCalledWith("github-subscriptions.hbs", expect.objectContaining({
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			installation,
			info: { things: "stuff" },
			host: res.locals.jiraHost,
			hasSubscriptions: true
		}));
	});

	it("Should throw Error inside Next when API failure occurs", async () => {
		
		res.locals.isAdmin = jest.fn().mockResolvedValue(false);

		createGitHubNockGet("/user", 200, { login: "test-org" });

		createGitHubNockGet("/app/installations/15", 200, {
			target_type: "Org", account: { login: "test-org" }
		});

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("Unable to show subscription page"));
	});

	it("Should throw Unaothorized Error inside Next when API not admin", async () => {
		res.locals.isAdmin = jest.fn().mockRejectedValue(new Error("Whoops"));

		createGitHubNockGet("/user", 200, { login: "test-org" });

		createGitHubNockGet("/app/installations/15", 200, {
			target_type: "Org", account: { login: "test-org" }
		});

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("Unauthorized"));
	});


	it("Should 401 when missing githubToken", async () => {

		res = {
			sendStatus: jest.fn(),
			locals: {}
		};

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("Unauthorized"));
	});

	it("Missing installationId", async () => {
		delete req.params["installationId"];

		res.status.mockReturnValue(res);

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("installationId and jiraHost must be provided to delete a subscription."));
	});

	it("Missing jirahost", async () => {
		delete res.locals["jiraHost"];

		res.status.mockReturnValue(res);

		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("installationId and jiraHost must be provided to delete a subscription."));
	});
});


describe("/github/subscription - octokit", () => {

	const gitHubInstallationId = 15;
	const jiraHost = "mock-host";
	let req, res, next;

	beforeEach(async () => {
		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_GET_SUBSCRIPTION,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(false);

		next = jest.fn();

		req = {
			log: { child:() => ({ error: jest.fn(), info: jest.fn()}) },
			params: {
				installationId: gitHubInstallationId
			},
			csrfToken: jest.fn()
		};

		const githubAppGetAuthenticated = jest.fn().mockResolvedValue({ data: { things: "stuff" } });
		const githubUsersGetAuthenticated = jest.fn().mockResolvedValue({ data: { login: "test-user" } });
		const getInstallation = jest.fn().mockResolvedValue({
			data: {
				id: gitHubInstallationId,
				target_type: "User",
				account: { login: "test-user" }
			}
		});

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
				client: {
					apps: { 
						getInstallation,
						getAuthenticated: githubAppGetAuthenticated
					}
				},
				github: {
					users: { getAuthenticated: githubUsersGetAuthenticated}
				}
			}
		};
	});

	it("Should get GitHub Subscriptions", async () => {
		
		await GithubSubscriptionGet(req as any, res as any, next as any);

		expect(res.render).toHaveBeenCalledWith("github-subscriptions.hbs", expect.objectContaining({
			csrfToken: req.csrfToken(),
			nonce: res.locals.nonce,
			info: { things: "stuff" },
			host: res.locals.jiraHost,
			hasSubscriptions: true
		}));
	});

	it("Should throw Error inside Next when API failure occurs", async () => {
		res.locals.github.users.getAuthenticated = jest.fn().mockRejectedValue(new Error("Whoops"));
		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("Unable to show subscription page"));
	});

	it("Should throw Unaothorized Error inside Next when API not admin", async () => {
		res.locals.isAdmin = jest.fn().mockResolvedValue(false);
		await GithubSubscriptionGet(req as any, res as any, next as any);
		expect(next).toHaveBeenCalledWith(new Error("Unauthorized"));
	});



});
