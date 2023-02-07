import supertest from "supertest";
import { Application } from "express";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { getFrontendApp } from "~/src/app";
import { getHashedKey } from "models/sequelize";

const PLAIN_CLIENT_KEY = "plain-client-key";

describe("Subscription jiraClientKey restore", () => {

	let app: Application;
	let inst: Installation;

	beforeEach(async () => {
		app = getFrontendApp();
		inst = await Installation.install({
			host: jiraHost,
			clientKey: PLAIN_CLIENT_KEY,
			sharedSecret: "1234"
		});
	});

	it("should restore subscription jiraClientKey", async () => {
		//preparing double hashed data
		const sub = await Subscription.install({
			hashedClientKey: getHashedKey(getHashedKey(PLAIN_CLIENT_KEY)),
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
	});

});
