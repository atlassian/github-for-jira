import supertest from "supertest";
import { Application } from "express";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { getFrontendApp } from "~/src/app";
import { getHashedKey } from "models/sequelize";

const PLAIN_CLIENT_KEY = "plain-client-key";
const SINGLE_HASHED_PLAIN_CLIENT_KEY = getHashedKey(PLAIN_CLIENT_KEY);
const DOUBLE_HASHED_PLAIN_CLIENT_KEY = getHashedKey(SINGLE_HASHED_PLAIN_CLIENT_KEY);

describe("Subscription jiraClientKey restore", () => {

	let app: Application;
	let inst: Installation;

	beforeEach(async () => {
		app = getFrontendApp();
		//three installations with same jira host but one later one earlier
		await Installation.install({ host: jiraHost, clientKey: "some-previous-client-key", sharedSecret: "0000" });
		inst = await Installation.install({ host: jiraHost, clientKey: PLAIN_CLIENT_KEY, sharedSecret: "1234" });
		await Installation.install({ host: jiraHost, clientKey: "some-later-client-key", sharedSecret: "5678" });
		//some random installations with random jira host
		await Installation.install({ host: jiraHost + "-some-randome-jirahost1", clientKey: "random-client-key1", sharedSecret: "9998" });
		await Installation.install({ host: jiraHost + "-some-randome-jirahost2", clientKey: "random-client-key2", sharedSecret: "9999" });
	});

	it("should restore subscription jiraClientKey", async () => {
		//preparing double hashed data
		const sub = await Subscription.install({
			hashedClientKey: DOUBLE_HASHED_PLAIN_CLIENT_KEY,
			host: jiraHost,
			gitHubAppId: undefined,
			installationId: 123
		});

		//call api
		await supertest(app)
			.post(`/api/data-cleanup/restore-subscription-client-key?maxSubscriptionId=${sub.id}`)
			.set("X-Slauth-Mechanism", "test").expect(200);

		//check result is correct
		const foundSub: Subscription = await Subscription.findByPk(sub.id);
		expect(foundSub.jiraHost).toBe(jiraHost);
		expect(foundSub.jiraClientKey).toBe(inst.clientKey);
		expect(foundSub.jiraClientKey).toBe(SINGLE_HASHED_PLAIN_CLIENT_KEY);
	});

	it("should NOT restore subscription jiraClientKey if not installation found by jiraHost", async () => {
		//preparing double hashed data
		const sub = await Subscription.install({
			hashedClientKey: DOUBLE_HASHED_PLAIN_CLIENT_KEY,
			host: jiraHost + "-some-non-exists-site",
			gitHubAppId: undefined,
			installationId: 123
		});

		//call api
		await supertest(app)
			.post(`/api/data-cleanup/restore-subscription-client-key?maxSubscriptionId=${sub.id}`)
			.set("X-Slauth-Mechanism", "test").expect(200);

		//check result is correct
		const foundSub: Subscription = await Subscription.findByPk(sub.id);
		expect(foundSub.jiraHost).toBe(jiraHost + "-some-non-exists-site");
		expect(foundSub.jiraClientKey).toBe(DOUBLE_HASHED_PLAIN_CLIENT_KEY);
	});

	it("should restore subscription jiraClientKey to the installation with same jiraHost and matching client key after double hashed", async () => {
		//preparing double hashed data
		const sub = await Subscription.install({
			hashedClientKey: DOUBLE_HASHED_PLAIN_CLIENT_KEY,
			host: jiraHost,
			gitHubAppId: undefined,
			installationId: 123
		});

		//call api
		await supertest(app)
			.post(`/api/data-cleanup/restore-subscription-client-key?maxSubscriptionId=${sub.id}`)
			.set("X-Slauth-Mechanism", "test").expect(200);

		//check result is correct
		const foundSub: Subscription = await Subscription.findByPk(sub.id);
		expect(foundSub.jiraHost).toBe(jiraHost);
		expect(foundSub.jiraClientKey).toBe(inst.clientKey);
		expect(foundSub.jiraClientKey).toBe(SINGLE_HASHED_PLAIN_CLIENT_KEY);
	});

});
