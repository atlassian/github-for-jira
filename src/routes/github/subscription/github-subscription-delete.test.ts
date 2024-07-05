/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { GithubSubscriptionDelete } from "./github-subscription-delete";
import { GitHubServerApp } from "models/github-server-app";
import { when } from "jest-when";
import { getLogger } from "config/logger";

jest.mock("models/github-server-app");

const createGitHubNockGet = (url, status, response) => {
	githubNock
		.get(url)
		.reply(status, response);
};

describe("delete-github-subscription", () => {
	const gitHubInstallationId = 15;
	const gitHubAppId = 1;
	let req, res, gitHubApp;

	beforeEach(async () => {
		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		await Installation.create({
			jiraHost,
			clientKey: "client-key",
			encryptedSharedSecret: "shared-secret"
		});

		req = {
			log: getLogger("test"),
			body: {
				installationId: gitHubInstallationId,
				jiraHost
			},
			params: {}
		};

		res = {
			sendStatus: jest.fn(),
			status: jest.fn(),
			json: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token",
				gitHubAppConfig: {}
			}
		};
	});

	it("Should delete GitHub Subscription as an Org admin - installation type Org | Cloud", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-org" }, target_type: "Org"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-org"
		});
		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "admin", user: { login: "test-org" }
		});

		await GithubSubscriptionDelete(req , res);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(0);
	});

	it("Should delete GitHub Subscription as an Org admin - installation type Org | Server", async () => {
		res.locals.gitHubAppConfig.gitHubAppId = gitHubAppId;

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

		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-org" }, target_type: "Org"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-org"
		});
		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "admin", user: { login: "test-org" }
		});

		await GithubSubscriptionDelete(req , res);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Should delete GitHub Subscription as an User - installation type User | Cloud", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-user" }, target_type: "User"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-user"
		});

		await GithubSubscriptionDelete(req , res);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(0);
	});

	it("Should delete GitHub Subscription as an User - installation type User | Server", async () => {
		const gitHubAppId = 1;
		res.locals.gitHubAppConfig.gitHubAppId = gitHubAppId;
		req.params.uuid = uuid;

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

		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-user" }, target_type: "User"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-user"
		});

		await GithubSubscriptionDelete(req , res);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Shoud 401 when trying to delete GitHub Subscription without delete rights - installation type Org", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-org" }, target_type: "Org"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-org"
		});
		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "notadmin", user: { login: "test-org" }
		});

		await GithubSubscriptionDelete(req , res);
		expect(res.status).toHaveBeenCalledWith(401);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Shoud 401 when trying to delete GitHub Subscription without delete rights - installation type User", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "something-something-test-user" }, target_type: "user"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-org"
		});
		createGitHubNockGet("/user/memberships/orgs/something-something-test-user", 200, {
			role: "batman", user: { login: "test-user" }
		});

		await GithubSubscriptionDelete(req , res);
		expect(res.status).toHaveBeenCalledWith(401);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Should 401 when missing githubToken", async () => {

		res = {
			sendStatus: jest.fn(),
			locals: {}
		};

		await GithubSubscriptionDelete(req , res);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

	it.each([["installationId"], ["jiraHost"]])("Should 400 when missing body.%s", async (property) => {
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete req.body[property];
		// eslint-disable-next-line @typescript-eslint/no-dynamic-delete
		delete res.locals[property];

		res.status.mockReturnValue(res);

		await GithubSubscriptionDelete(req , res);
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json.mock.calls[0]).toMatchSnapshot([
			{
				err: expect.any(String)
			}
		]);
	});
});
