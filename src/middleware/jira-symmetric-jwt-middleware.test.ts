import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import express, { Application, NextFunction, Request, Response } from "express";
import { noop } from "lodash";
import supertest from "supertest";
import { getLogger } from "~/src/config/logger";
import {
	checkGenericContainerActionUrl,
	getTokenType,
	jiraSymmetricJwtMiddleware
} from "~/src/middleware/jira-symmetric-jwt-middleware";
import { Installation } from "~/src/models/installation";
import { generateSignedSessionCookieHeader } from "test/utils/cookies";

const testSharedSecret = "test-secret";

const getToken = ({
	secret = "secret",
	iss = "jira-client-key",
	exp = Date.now() / 1000 + 10000,
	qsh = "context-qsh" }): any => {
	return encodeSymmetric({
		qsh,
		iss,
		exp
	}, secret);
};

describe("jiraSymmetricJwtMiddleware", () => {
	let app: Application;
	let session: { jiraHost?: string } = { };

	beforeEach(async () => {

		app = createApp();

		await Installation.install({
			clientKey: "jira-client-key",
			host: jiraHost,
			sharedSecret: testSharedSecret
		});
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

		const token = getToken({ secret: testSharedSecret, iss: "" });

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});

	it("should throw error when no installation is found", async () => {

		const token = getToken({ secret: testSharedSecret, iss: "jira-wrong-key" });

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});

	it("should return valid response when token is valid", async () => {

		const token = getToken({ secret: testSharedSecret });

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.expect(200);
	});

	it("should set res.locals and req.session when token is valid", async () => {

		session = {};
		const token = getToken({ secret: testSharedSecret });

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(200);
				expect(JSON.parse(res.text).installation.jiraHost).toEqual(jiraHost);
				expect(JSON.parse(res.text).jiraHost).toEqual(jiraHost);
				expect(session.jiraHost).toEqual(jiraHost);
			});
	});

	it("should throw error when token secret mismatch", async () => {

		const token = getToken({ secret: "wrong-secret" });

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});

	it("should throw error when token expired", async () => {

		const token = getToken({ secret: testSharedSecret, iss: "jira-client-key", exp: Date.now() / 1000 - 1000 });

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

		session.jiraHost = jiraHost;

		await supertest(app)
			.get(`/test`)
			.then((res) => {
				expect(JSON.parse(res.text).installation.jiraHost).toEqual(jiraHost);
				expect(JSON.parse(res.text).jiraHost).toEqual(jiraHost);
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
				expect(session.jiraHost).toEqual(undefined);
			});
	});

	it("should throw error when invalid qsh in token", async () => {

		const token = getToken({ secret: testSharedSecret, qsh: "wrong-qsh" });

		await supertest(app)
			.get(`/test`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});

	it("should throw error when computed qsh doesn't match", async () => {

		app.get("/jira/configuration", (_req, res) => {
			res.send("ok");
		});

		const token = getToken({ secret: testSharedSecret });

		await supertest(app)
			.get(`/jira/configuration`)
			.query({ jwt: token })
			.then((res) => {
				expect(res.status).toEqual(401);
				expect(res.text).toEqual("Unauthorised");
			});
	});

	it("should return valid response when token having computed qsh", async () => {

		app.get("/jira/configuration", (_req, res) => {
			res.send("ok");
		});

		const qsh = createQueryStringHash({ method: "GET", pathname: "/jira/configuration" });
		const token = getToken({ secret: testSharedSecret, qsh });


		await supertest(app)
			.get("/jira/configuration")
			.query({ jwt: token })
			.expect(200);
	});

	describe("Util - checkGenericContainerActionUrl",  () => {
		let installation;

		beforeEach(async () => {
			app = createApp();

			installation = await Installation.install({
				clientKey: "jira-client-key",
				host: jiraHost,
				sharedSecret: testSharedSecret
			});
		});

		it("should return true for search workspaces", async () => {
			const generateJwt = async (query: any = {}) => {
				return encodeSymmetric({
					qsh: createQueryStringHash({
						method: "GET",
						pathname: "/jira/workspaces/search",
						query
					}, false),
					iss: installation.plainClientKey
				}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
			};

			await supertest(app)
				.get("/jira/workspaces/search")
				.set({
					authorization: `JWT ${await generateJwt()}`
				});

			expect(await checkGenericContainerActionUrl(
				"https://test-github-app-instance.com/jira/workspaces/search"))
				.toBeTruthy();
		});

		it("should return true for search repositories", async () => {
			const generateJwt = async (query: any = {}) => {
				return encodeSymmetric({
					qsh: createQueryStringHash({
						method: "GET",
						pathname: "/jira/workspaces/repositories/search",
						query
					}, false),
					iss: installation.plainClientKey
				}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
			};

			await supertest(app)
				.get("/jira/workspaces/repositories/search?searchQuery=atlas")
				.set({
					authorization: `JWT ${await generateJwt(
						{
							searchQuery: "atlas"
						}
					)}`
				});

			expect(await checkGenericContainerActionUrl(
				"https://test-github-app-instance.com/jira/workspaces/repositories/search?searchQuery=atlas"))
				.toBeTruthy();
		});

		it("should return true for associate repository", async () => {
			const generateJwt = async (query: any = {}) => {
				return encodeSymmetric({
					qsh: createQueryStringHash({
						method: "POST",
						pathname: "/jira/workspaces/repositories/associate",
						query
					}, false),
					iss: installation.plainClientKey
				}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
			};

			await supertest(app)
				.post("/jira/workspaces/repositories/associate")
				.set({
					authorization: `JWT ${await generateJwt()}`
				});

			expect(await checkGenericContainerActionUrl("https://test-github-app-instance.com/jira/workspaces/repositories/associate")).toBeTruthy();
		});

		it("should return false for create branch", async () => {
			await supertest(app)
				.get("/create-branch-options").set(
					"Cookie",
					generateSignedSessionCookieHeader({
						jiraHost,
						githubToken: "random-token"
					}));

			expect(await checkGenericContainerActionUrl(
				"https://test-github-app-instance.com/create-branch-options"))
				.toBeFalsy();
		});
	});

	describe("Util - getTokenType",  () => {
		let installation;

		beforeEach(async () => {
			app = createApp();

			installation = await Installation.install({
				clientKey: "jira-client-key",
				host: jiraHost,
				sharedSecret: testSharedSecret
			});
		});

		it("should return normal tokenType for search workspaces", async () => {
			const generateJwt = async (query: any = {}) => {
				return encodeSymmetric({
					qsh: createQueryStringHash({
						method: "GET",
						pathname: "/jira/workspaces/search",
						query
					}, false),
					iss: installation.plainClientKey
				}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
			};

			await supertest(app)
				.get("/jira/workspaces/search")
				.set({
					authorization: `JWT ${await generateJwt()}`
				});

			expect(await getTokenType("/jira/workspaces/search", "GET")).toEqual("normal");
		});

		it("should return normal tokenType for search repositories", async () => {
			const generateJwt = async (query: any = {}) => {
				return encodeSymmetric({
					qsh: createQueryStringHash({
						method: "GET",
						pathname: "/jira/workspaces/repositories/search",
						query
					}, false),
					iss: installation.plainClientKey
				}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
			};

			await supertest(app)
				.get("/jira/workspaces/repositories/search?searchQuery=atlas")
				.set({
					authorization: `JWT ${await generateJwt(
						{
							searchQuery: "atlas"
						}
					)}`
				});

			expect(await getTokenType("/jira/workspaces/repositories/search?searchQuery=atlas", "GET")).toEqual("normal");
		});

		it("should return normal tokenType for associate repository", async () => {
			const generateJwt = async (query: any = {}) => {
				return encodeSymmetric({
					qsh: createQueryStringHash({
						method: "POST",
						pathname: "/jira/workspaces/repositories/associate",
						query
					}, false),
					iss: installation.plainClientKey
				}, await installation.decrypt("encryptedSharedSecret", getLogger("test")));
			};

			await supertest(app)
				.post("/jira/workspaces/repositories/associate")
				.set({
					authorization: `JWT ${await generateJwt()}`
				});

			expect(await getTokenType("/jira/workspaces/repositories/associate", "POST")).toEqual("normal");
		});

		it("should return context tokenType for create branch", async () => {
			await supertest(app)
				.get("/create-branch-options").set(
					"Cookie",
					generateSignedSessionCookieHeader({
						jiraHost,
						githubToken: "random-token"
					}));

			expect(await getTokenType("/create-branch-options", "GET")).toEqual("context");
		});
	});

	const createApp = () => {
		const app = express();
		app.use((req: Request, _: Response, next: NextFunction) => {
			req.session = session; // by reference
			req.cookies = { };
			req.log = getLogger("test");
			req.addLogFields = () => noop;
			next();
		});
		app.use(jiraSymmetricJwtMiddleware);
		app.get("/test", (_req, res) => {
			res.send(JSON.stringify(res.locals));
		});
		return app;
	};

});
