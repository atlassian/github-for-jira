/* eslint-disable @typescript-eslint/no-explicit-any */
import { Installation, Subscription } from "../../../src/models";
import { GithubSubscriptionDelete } from "../../../src/routes/github/subscription/github-subscription-delete";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../../src/config/feature-flags";

jest.mock("../../../src/config/feature-flags");

const createGitHubNockGet = (url, status, response) => {
	githubNock
		.get(url)
		.reply(status, response);
};

describe("POST /github/subscription - octokit", () => {

	const gitHubInstallationId = 15;

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

		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DELETE_SUBSCRIPTION,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(false);

	});

	test("Delete Jira Configuration", async () => {

		const req = {
			log: { error: jest.fn(), info: jest.fn() },
			body: {
				installationId: gitHubInstallationId,
				jiraHost
			}
		};

		const login = "test-user";
		const role = "admin";

		const getMembershipForAuthenticatedUser = jest.fn().mockResolvedValue({ data: { role, user: { login } } });
		const getInstallation = jest.fn().mockResolvedValue({
			data: {
				id: gitHubInstallationId,
				target_type: "User",
				account: { login }
			}
		});
		const res = {
			sendStatus: jest.fn(),
			status: jest.fn(),
			locals: {
				jiraHost,
				githubToken: "abc-token",
				client: {
					apps: { getInstallation }
				},
				github: {
					orgs: { getMembershipForAuthenticatedUser }
				}
			}
		};

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(0);
	});
});

describe("POST /github/subscription", () => {
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

		when(booleanFlag).calledWith(
			BooleanFlags.USE_NEW_GITHUB_CLIENT_FOR_DELETE_SUBSCRIPTION,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);

		req = {
			log: { error: jest.fn(), info: jest.fn() },
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

	it("Delete Jira Configuration as an Org admin", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-org" }, type: "Org"
		});
		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "admin", user: { login: "test-org" }
		});

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(0);
	});

	it("Delete Jira Configuration as an User", async () => {

		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-user" }, type: "User"
		});
		createGitHubNockGet("/user/memberships/orgs/test-user", 200, {
			role: "batman", user: { login: "test-user" }
		});

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(202);
		expect(await Subscription.count()).toEqual(0);
	});

	it("Attemplt delete Jira Configuration Org - not authorized", async () => {

		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-org" }, type: "Org"
		});
		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "notadmin", user: { login: "test-org" }
		});

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.status).toHaveBeenCalledWith(401);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Missing githubToken", async () => {

		res = {
			sendStatus: jest.fn(),
			locals: {}
		};

		await GithubSubscriptionDelete(req as any, res as any);
		expect(res.sendStatus).toHaveBeenCalledWith(401);
	});

	test.each([["installationId"], ["jiraHost"]])("missing body.%s",
		async (property) => {

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
		}
	);
});