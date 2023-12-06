import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { encodeSymmetric } from "atlassian-jwt";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";

const createGitHubNockGet = (url, status, response) => {
	githubNock
		.get(url)
		.reply(status, response);
};

describe("delete-subscription", () => {
	const testSharedSecret = "test-secret";
	const gitHubInstallationId = 15;
	const getToken = ({
		secret = testSharedSecret,
		iss = "jira-client-key",
		exp = Date.now() / 1000 + 10000,
		qsh = "context-qsh" } = {}): string => encodeSymmetric({
		qsh,
		iss,
		exp
	}, secret);
	let app;
	beforeEach(async () => {
		app = getFrontendApp();
		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
		await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});
	});

	it("Should 400 when missing body", async () => {
		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions")
			.set("authorization", `${getToken()}`)
			.set("github-auth", "github-token");

		expect(resp.status).toBe(400);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Should delete GitHub Subscription as an Org admin - installation type Org | Cloud", async () => {
		createGitHubNockGet("/app/installations/" + gitHubInstallationId, 200, {
			account: { login: "test-org" }, target_type: "Org"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-org"
		});
		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "admin", user: { login: "test-org" }
		});

		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions")
			.set("authorization", `${getToken()}`)
			.set("github-auth", "github-token")
			.send({ installationId: gitHubInstallationId });

		expect(resp.status).toBe(202);
		expect(await Subscription.count()).toEqual(0);
	});

	it("Should delete GitHub Subscription as an User - installation type User | Cloud", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-user" }, target_type: "User"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-user"
		});


		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions")
			.set("authorization", `${getToken()}`)
			.set("github-auth", "github-token")
			.send({ installationId: gitHubInstallationId });

		expect(resp.status).toBe(202);
		expect(await Subscription.count()).toEqual(0);
	});

	it("Should 403 when trying to delete GitHub Subscription without delete rights - installation type Org", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "test-org" }, target_type: "Org"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-org"
		});
		createGitHubNockGet("/user/memberships/orgs/test-org", 200, {
			role: "notadmin", user: { login: "test-org" }
		});

		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions")
			.set("authorization", `${getToken()}`)
			.set("github-auth", "github-token")
			.send({ installationId: gitHubInstallationId });

		expect(resp.status).toBe(403);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Should 403 when trying to delete GitHub Subscription without delete rights - installation type User", async () => {
		createGitHubNockGet("/app/installations/15", 200, {
			account: { login: "something-something-test-user" }, target_type: "user"
		});
		createGitHubNockGet("/user", 200, {
			login: "test-org"
		});
		createGitHubNockGet("/user/memberships/orgs/something-something-test-user", 200, {
			role: "batman", user: { login: "test-user" }
		});
		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions")
			.set("authorization", `${getToken()}`)
			.set("github-auth", "github-token")
			.send({ installationId: gitHubInstallationId });

		expect(resp.status).toBe(403);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Should 401 when missing githubToken", async () => {
		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions")
			.set("authorization", `${getToken()}`)
			.send({ installationId: gitHubInstallationId });

		expect(resp.status).toBe(401);
		expect(await Subscription.count()).toEqual(1);
	});
});
