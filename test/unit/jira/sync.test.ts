import InstallationClass from "../../../src/models/installation";
import { Installation, Subscription } from "../../../src/models";
import express, { Express, NextFunction, Request, Response } from "express";
import { RootRouter } from "../../../src/routes/router";
import supertest from "supertest";
import { sqsQueues } from "../../../src/sqs/queues";
import { getLogger } from "../../../src/config/logger";
import { encodeSymmetric } from "atlassian-jwt";

jest.mock("../../../src/sqs/queues");

describe("sync", () => {
	let app: Express;
	let installation: InstallationClass;
	let jwt:string;

	beforeEach(async () => {
		installation = await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "client-key"
		});
		await Subscription.install({
			installationId: installation.id,
			host: jiraHost,
			clientKey: installation.clientKey
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
			iss: jiraHost
		}, installation.sharedSecret);
	});

	it("should return 200 on correct post for /jira/sync", async () => {
		return supertest(app)
			.post("/jira/sync")
			.query({
				jwt,
				xdm_e: jiraHost
			})
			.send({
				installationId: installation.id,
				jiraHost,
				syncType: "full"
			})
			.expect(202)
			.then(() => {
				expect(sqsQueues.discovery.sendMessage).toBeCalledWith({ installationId: installation.id, jiraHost }, expect.anything(), expect.anything());
			});
	});
});
