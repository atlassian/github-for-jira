import { getLogger } from "config/logger";
import express, { Application } from "express";
import { getFrontendApp } from "~/src/app";
import supertest from "supertest";
import { Installation } from "models/installation";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { Errors } from "config/errors";
import { Subscription } from "models/subscription";

describe("Workspaces Post", () => {
	let app: Application;
	let installation: Installation;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "jira-client-key"
		});
	});

	const generateJwt = async (query: any = {}) => {
		return encodeSymmetric({
			qsh: createQueryStringHash({
				method: "POST",
				pathname: "/jira/security/workspaces/search",
				query
			}, false),
			iss: installation.plainClientKey
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
	};

	it("Should return a 400 status if no IDs are passed in the body", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.expect(res => {
				expect(res.status).toBe(400);
				expect(res.text).toContain(Errors.MISSING_WORKSPACE_IDS);
			});
	});

	it("Should return an empty array if no matching subscriptions are found", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const response = {
			success: true,
			workspaces: []
		};

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: ["1234", "2345"]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should only return subscription once even if gitHubInstallationId is passed multiple times", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const sub1 = await Subscription.create({
			gitHubInstallationId: 1234,
			jiraHost,
			jiraClientKey: "client-key"
		});

		const response = {
			success: true,
			workspaces: [
				{
					id: sub1.gitHubInstallationId.toString(),
					name: "",
					url: "",
					avatarUrl: ""
				}
			]
		};

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [sub1.gitHubInstallationId]
			})
			.expect(res => {
				expect(res.status).toBe(200);
				expect(res.text).toContain(JSON.stringify(response));
			});
	});

	it("Should return all subscriptions for provided IDs", async () => {
		app = express();
		app.use((req, _, next) => {
			req.log = getLogger("test");
			next();
		});
		app.use(getFrontendApp());

		const sub1 = await Subscription.create({
			gitHubInstallationId: 1234,
			jiraHost,
			jiraClientKey: "client-key"
		});

		const sub2 = await Subscription.create({
			gitHubInstallationId: 2345,
			jiraHost,
			jiraClientKey: "client-key"
		});

		const sub3 = await Subscription.create({
			gitHubInstallationId: 3456,
			jiraHost,
			jiraClientKey: "client-key"
		});

		await supertest(app)
			.post("/jira/security/workspaces/search")
			.set({
				authorization: `JWT ${await generateJwt()}`
			})
			.send({
				ids: [sub1.gitHubInstallationId, sub2.gitHubInstallationId, sub3.gitHubInstallationId]
			})
			.expect(res => {
				expect(res.status).toBe(200);
			});
	});


});
