import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import express, { Express, NextFunction, Request, Response } from "express";
import { RootRouter } from "routes/router";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { encodeSymmetric } from "atlassian-jwt";
import { sqsQueues } from "~/src/sqs/queues";
import { GitHubServerApp } from "models/github-server-app";
import { v4 as newUUID } from "uuid";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";

jest.mock("~/src/sqs/queues");
jest.mock("config/feature-flags");

describe("sync", () => {
	let app: Express;
	let installation: Installation;
	const installationIdForCloud = 1;
	const installationIdForServer = 2;
	let gitHubServerApp: GitHubServerApp;
	let jwt: string;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "jira-client-key"
		});
		await Subscription.install({
			installationId: installationIdForCloud,
			host: jiraHost,
			hashedClientKey: installation.clientKey,
			gitHubAppId: undefined
		});
		gitHubServerApp = await GitHubServerApp.install({
			uuid: newUUID(),
			appId: 123,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: installation.id
		}, jiraHost);
		await Subscription.install({
			installationId: installationIdForServer,
			host: jiraHost,
			hashedClientKey: installation.clientKey,
			gitHubAppId: gitHubServerApp.id
		});
		app = express();
		app.use((req: Request, res: Response, next: NextFunction) => {
			res.locals = { installation };
			req.log = getLogger("test");
			req.session = { jiraHost };
			next();
		});
		app.use(RootRouter);

		jwt = encodeSymmetric({
			qsh: "context-qsh",
			iss: "jira-client-key"
		}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));

		when(booleanFlag).calledWith(
			BooleanFlags.USE_BACKFILL_ALGORITHM_INCREMENTAL,
			expect.anything()
		).mockResolvedValue(true);
	});

	it("should return 200 on correct post for /jira/sync for Cloud app", async () => {
		return supertest(app)
			.post("/jira/sync")
			.query({
				jwt
			})
			.send({
				installationId: installationIdForCloud,
				jiraHost,
				syncType: "full"
			})
			.expect(202)
			.then(() => {
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(expect.objectContaining({
					installationId: installationIdForCloud,
					jiraHost,
					startTime: expect.anything(),
					gitHubAppConfig: expect.objectContaining({ gitHubAppId: undefined, uuid: undefined })
				}), expect.anything(), expect.anything());
			});
	});

	it("should return 200 on correct post for /jira/sync for Server app", async () => {
		return supertest(app)
			.post("/jira/sync")
			.query({
				jwt
			})
			.send({
				installationId: installationIdForServer,
				jiraHost,
				syncType: "full",
				appId: gitHubServerApp.id
			})
			.expect(202)
			.then(() => {
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(expect.objectContaining({
					installationId: installationIdForServer,
					jiraHost,
					startTime: expect.anything(),
					gitHubAppConfig: expect.objectContaining({ gitHubAppId: gitHubServerApp.id, uuid: gitHubServerApp.uuid })
				}), expect.anything(), expect.anything());
			});
	});

	it("should run incremental sync", async() => {
		const commitsFromDate = new Date(new Date().getTime() - 2000);
		const backfillSince = new Date(new Date().getTime() - 1000);
		const subscription = await Subscription.getSingleInstallation(
			jiraHost,
			installationIdForServer,
			gitHubServerApp.id
		);
		await subscription?.update({
			syncStatus: "COMPLETE",
			backfillSince
		});
		return supertest(app)
			.post("/jira/sync")
			.query({
				jwt
			})
			.send({
				installationId: installationIdForServer,
				jiraHost,
				appId: gitHubServerApp.id,
				commitsFromDate
			})
			.expect(202)
			.then(() => {
				expect(sqsQueues.backfill.sendMessage).toBeCalledWith(expect.objectContaining({
					syncType: "partial",
					installationId: installationIdForServer,
					jiraHost,
					commitsFromDate: commitsFromDate.toISOString(),
					gitHubAppConfig: expect.objectContaining({ gitHubAppId: gitHubServerApp.id, uuid: gitHubServerApp.uuid })
				}), expect.anything(), expect.anything());
			});
	});

});
