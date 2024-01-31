import { encodeSymmetric } from "atlassian-jwt";
import express, { Application, NextFunction, Request, Response } from "express";
import { noop } from "lodash";
import supertest from "supertest";
import { getLogger } from "config/logger";
import { GitHubTokenHandler } from "./github-token";
import { JwtHandler } from "~/src/rest/middleware/jwt/jwt-handler";
import { Installation } from "models/installation";

const testSharedSecret = "test-secret";
const githubToken = "test-github-token";

describe("Github token handler", () => {

	let app: Application;

	const createApp = () => {
		const app = express();
		app.use((req: Request, _: Response, next: NextFunction) => {
			req.log = getLogger("test");
			req.addLogFields = () => noop;
			next();
		});
		app.use(JwtHandler);
		app.use(GitHubTokenHandler);
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
		qsh = "context-qsh" } = {}) => {
		return encodeSymmetric({
			qsh,
			iss,
			exp
		}, secret);
	};

	const sendRequestWithToken = async (token: string | undefined, githubToken: string | undefined) => {
		let request = supertest(app).get(`/test`);
		if (token) {
			request = request.set("Authorization", token);
		}
		if (githubToken) {
			request = request.set("github-auth", githubToken);
		}
		return await request.send();
	};

	beforeEach(async () => {
		app = createApp();
		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
	});

	it("should throw error when both JWT & github token is missing", async () => {
		const res = await sendRequestWithToken(undefined, undefined);

		expect(res.status).toEqual(401);
		expect(res.text).toEqual("Unauthorised");
	});

	it("should throw error when JWT is set but github token is missing", async () => {
		const token = getToken();
		const res = await sendRequestWithToken(token, undefined);

		expect(res.status).toEqual(401);
		expect(res.text).toEqual("Github token invalid");
	});

	it("should set res.locals when JWT and github token are both available", async () => {
		const token = getToken();
		const res = await sendRequestWithToken(token, githubToken);

		expect(res.status).toEqual(200);
		const json = JSON.parse(res.text) as { jiraHost: string, githubToken: string };
		expect(json.jiraHost).toEqual(jiraHost);
		expect(json.githubToken).toEqual(githubToken);
	});
});
