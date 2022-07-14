/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { GithubSubscriptionDelete } from "./github-subscription-delete";

const createGitHubNockGet = (url, status, response) => {
	githubNock
		.get(url)
		.reply(status, response);
};

describe("delete-github-subscription", () => {
	const gitHubInstallationId = 15;
	let req, res;

	beforeEach(async () => {
		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});

		await Installation.create({
			jiraHost,
			clientKey: "client-key",
			sharedSecret: "shared-secret"
		});

		req = {
			log: { child:() => ({ error: jest.fn(), info: jest.fn() }) },
			body: {
				installationId: gitHubInstallationId,
				jiraHost
			}
		};

		res = {
			sendStatus: jest.fn(),
			status: jest.fn(),
			json: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token"
			}
		};

	});

	it("Should delete GitHub Subscription as an Org admin - installation type Org", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-org" }, target_type: "Org"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-org"
		});
		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "admin", user: { login: "test-org" }
		});

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(0);
	});

	it("Should delete GitHub Subscription as an User - installation type User", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-user" }, target_type: "User"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-user"
		});

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(0);
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

		await GithubSubscriptionDelete(req as any, res as any);
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

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.status).toHaveBeenCalledWith(401);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Should 401 when missing githubToken", async () => {

		res = {
			sendStatus: jest.fn(),
			locals: {}
		};

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

	it.each([["installationId"], ["jiraHost"]])("Should 400 when missing body.%s", async (property) => {
		delete req.body[property];
		delete res.locals[property];

		res.status.mockReturnValue(res);

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json.mock.calls[0]).toMatchSnapshot([
			{
				err: expect.any(String)
			}
		]);
	});
});