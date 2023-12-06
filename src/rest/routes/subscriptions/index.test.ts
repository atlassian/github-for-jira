import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { encodeSymmetric } from "atlassian-jwt";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { envVars } from "config/env";

describe("Subscription", () => {
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
	let app, subscription;
	beforeEach(async () => {
		app = getFrontendApp();
		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
		subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost
		});
	});

	it("Should return 400 for invalid delete subscription route", async () => {
		const resp = await supertest(app)
			.delete("/rest/subscriptions/" + gitHubInstallationId)
			.set("authorization", `${getToken()}`);

		expect(resp.status).toBe(404);
	});

	it("Should return 401 for valid delete subscription route when missing githubToken", async () => {
		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions/" + gitHubInstallationId);

		expect(resp.status).toBe(401);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Should return 404 for valid delete subscription route  when no valid subscriptionId is passed", async () => {
		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions/random-installation-id")
			.set("authorization", `${getToken()}`);

		expect(resp.status).toBe(404);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Should return 404 for valid delete subscription route  when a different subscriptionId is passed", async () => {
		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions/12")
			.set("authorization", `${getToken()}`);

		expect(resp.status).toBe(404);
		expect(await Subscription.count()).toEqual(1);
	});

	it("Should return 204 for valid delete subscription route when subscription is deleted", async () => {
		jiraNock
			.delete("/rest/devinfo/0.10/bulkByProperties")
			.query({ installationId: subscription.gitHubInstallationId })
			.reply(200, "OK");

		jiraNock
			.delete("/rest/builds/0.1/bulkByProperties")
			.query({ gitHubInstallationId: subscription.gitHubInstallationId })
			.reply(200, "OK");

		jiraNock
			.delete("/rest/deployments/0.1/bulkByProperties")
			.query({ gitHubInstallationId: subscription.gitHubInstallationId })
			.reply(200, "OK");

		jiraNock
			.put(`/rest/atlassian-connect/latest/addons/${envVars.APP_KEY}/properties/is-configured`, {
				isConfigured: false
			})
			.reply(200);

		const resp = await supertest(app)
			.delete("/rest/app/cloud/subscriptions/" + subscription.id)
			.set("authorization", `${getToken()}`);

		expect(resp.status).toBe(204);
		expect(await Subscription.count()).toEqual(0);
	});
});
