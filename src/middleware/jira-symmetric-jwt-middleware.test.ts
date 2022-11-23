import { encodeSymmetric } from "atlassian-jwt";
import express, { Application, NextFunction, Request, Response } from "express";
import { when } from "jest-when";
import supertest from "supertest";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";
import { getLogger } from "~/src/config/logger";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jira-symmetric-jwt-middleware";
import { Installation } from "~/src/models/installation";


jest.mock("config/feature-flags");
const testSharedSecret = "test-secret";

describe("jiraSymmetricJwtMiddleware", () => {
	let app: Application;
	let locals;
	let session;

	beforeEach(async () => {

		app = createApp();

		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});

		when(booleanFlag).calledWith(
			BooleanFlags.NEW_JWT_VALIDATION,
			expect.anything()
		).mockResolvedValue(true);

	});

	it("should throw error when token is missing and no jiraHost in session", async () => {

		await supertest(app)
			.get(`/test`)
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});

	it("should throw error when issuer is missing", async () => {

		const token = getToken(testSharedSecret, "");

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});

	it("should throw error when no installation is found", async () => {

		const token = getToken(testSharedSecret, "jira-worng-key");

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});

	it("should return valid response when token is valid", async () => {

		const token = getToken(testSharedSecret);

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.expect(200);
	});

	it("should set res.locals and req.session when token is valid", async () => {

		locals = {};
		session = {};
		const token = getToken(testSharedSecret);

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(200);
				expect(locals.installation.jiraHost).toEqual(jiraHost);
				expect(locals.jiraHost).toEqual(jiraHost);
				expect(session.jiraHost).toEqual(jiraHost);
			});
	});

	it("should throw error when token secret mismatch", async () => {

		const token = getToken("wrong-secret");

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});

	it("should return valid response when jiraHost set in session", async () => {

		session.jiraHost = jiraHost;

		await supertest(app)
			.get(`/test`)
			.expect(200);
	});

	it("should set res.locals and req.session when jiraHost set in session", async () => {

		locals = {};
		session.jiraHost = jiraHost;

		await supertest(app)
			.get(`/test`)
			.then((res) => {
				expect(res.status).toEqual(200);
				expect(locals.installation.jiraHost).toEqual(jiraHost);
				expect(locals.jiraHost).toEqual(jiraHost);
				expect(session.jiraHost).toEqual(jiraHost);
			});
	});

	it("should throw error when invalid jiraHost set in session", async () => {

		session.jiraHost = "http://wrong-host.atlassian.net";

		await supertest(app)
			.get(`/test`)
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});


	const createApp = () => {
		const app = express();
		app.use((req: Request, res: Response, next: NextFunction) => {
			res.locals = locals || {};
			req.session = session || {};
			req.cookies = {};
			req.log = getLogger("test");
			next();
		});
		app.use(jiraSymmetricJwtMiddleware);
		app.get("/test", (_req, res) => {
			res.send("ok");
		});
		return app;
	};

});

const getToken = (secret = "secret", iss = "jira-client-key"): any => {
	return encodeSymmetric({
		qsh: "context-qsh",
		iss
	}, secret);
};
