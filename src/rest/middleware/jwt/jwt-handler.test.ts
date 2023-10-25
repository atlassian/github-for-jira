import { encodeSymmetric } from "atlassian-jwt";
import express, { Application, NextFunction, Request, Response } from "express";
import { noop } from "lodash";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { JwtHandler } from "./jwt-handler";
import { Installation } from "models/installation";

const testSharedSecret = "test-secret";

describe("jwt handler", () => {

	let app: Application;

	beforeEach(async () => {

		app = createApp();

		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});

	});

	it("should throw error when token is missing", async () => {

		const res = await sendRequestWithToken(undefined);

		expect(res.status).toEqual(401);
		expect(res.text).toEqual("Unauthorised");
	});

	it("should throw error when issuer is missing", async () => {

		const token = getToken({ iss: "" });
		const res = await sendRequestWithToken(token);

		expect(res.status).toEqual(401);
		expect(res.text).toEqual("Unauthorised");
	});

	it("should throw error when no installation is found", async () => {

		const token = getToken({ iss: "jira-wrong-key" });
		const res = await sendRequestWithToken(token);

		expect(res.status).toEqual(401);
		expect(res.text).toEqual("Unauthorised");

	});

	it("should throw error when token secret mismatch", async () => {

		const token = getToken({ secret: "wrong-secret" });
		const res = await sendRequestWithToken(token);

		expect(res.status).toEqual(401);
		expect(res.text).toEqual("Unauthorised");
	});

	it("should throw error when token expired", async () => {

		const token = getToken({ exp: Date.now() / 1000 - 1000 });
		const res = await sendRequestWithToken(token);

		expect(res.status).toEqual(401);
		expect(res.text).toEqual("Unauthorised");
	});

	it("should throw error when invalid qsh in token", async () => {

		const token = getToken({ qsh: "wrong-qsh" });
		const res = await sendRequestWithToken(token);

		expect(res.status).toEqual(401);
		expect(res.text).toEqual("Unauthorised");
	});

	it("should return valid response when token is valid", async () => {

		const token = getToken();
		const res = await sendRequestWithToken(token);

		expect(res.status).toEqual(200);

	});

	it("should set res.locals and req.session when token is valid", async () => {

		const token = getToken();
		const res = await sendRequestWithToken(token);

		expect(res.status).toEqual(200);
		const json = JSON.parse(res.text) as { jiraHost: string, accountId: string };
		expect(json.jiraHost).toEqual(jiraHost);
		expect(json.accountId).toEqual("myAccount");

	});

	const createApp = () => {
		const app = express();
		app.use((req: Request, _: Response, next: NextFunction) => {
			req.log = getLogger("test");
			req.addLogFields = () => noop;
			next();
		});
		app.use("", JwtHandler);
		app.get("/test", (_req, res) => {
			res.send(JSON.stringify(res.locals));
		});
		app.use((err, _req, res, _next) => {
			// eslint-disable-next-line @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-call
			res.status(err.httpStatus || err.status).send(err.message);
		});
		return app;
	};

	const getToken = ({
		secret = testSharedSecret,
		iss = "jira-client-key",
		exp = Date.now() / 1000 + 10000,
		qsh = "context-qsh",
		sub = "myAccount" } = {}) => {
		return encodeSymmetric({
			qsh,
			iss,
			exp,
			sub
		}, secret);
	};

	const sendRequestWithToken = async (token: string | undefined) => {
		let request = supertest(app).get(`/test`);
		if (token) {
			request = request.set("Authorization", token);
		}
		return await request.send();
	};

});
