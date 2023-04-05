import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import express, { Application, NextFunction, Request, Response } from "express";
import { noop } from "lodash";
import supertest from "supertest";
import { getLogger } from "~/src/config/logger";
import { jiraSymmetricJwtMiddleware, setJiraAdminPrivileges } from "~/src/middleware/jira-symmetric-jwt-middleware";
import { Installation } from "~/src/models/installation";
import { getJiraClient } from "~/src/jira/client/jira-client";

jest.mock("~/src/jira/client/jira-client", () => {
	return {
		getJiraClient: jest.fn()
	};
});

jest.mock("config/feature-flags");
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
	let locals;
	let session;

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

		locals = {};
		session = {};
		const token = getToken({ secret: testSharedSecret });

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

		locals = {};
		session.jiraHost = jiraHost;

		await supertest(app)
			.get(`/test`)
			.then(() => {
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


	const createApp = () => {
		const app = express();
		app.use((req: Request, res: Response, next: NextFunction) => {
			res.locals = locals || {};
			req.session = session || {};
			req.cookies = {};
			req.log = getLogger("test");
			req.addLogFields = () => noop;
			next();
		});
		app.use(jiraSymmetricJwtMiddleware);
		app.get("/test", (_req, res) => {
			res.send("ok");
		});
		return app;
	};

});

describe("setJiraAdminPrivileges", () => {
	const mockRequest = {
		session: {},
		log: {
			info: jest.fn(),
			error: jest.fn()
		}
	} as unknown as Request;

	const mockedGetJiraClient = getJiraClient as jest.MockedFunction<typeof getJiraClient>;

	afterEach(() => {
		jest.resetAllMocks();
	});

	it("should set isJiraAdmin to true if user has ADMINISTER permissions", async () => {
		mockRequest.session.isJiraAdmin = undefined;
		const mockClaims = { sub: "1111" };
		const mockJiraClient = {
			permissions: {
				checkAdmin: jest.fn(() => ({
					data: {
						globalPermissions: ["ADMINISTER"]
					}
				}))
			}
		};
		mockedGetJiraClient.mockResolvedValueOnce(mockJiraClient);

		await setJiraAdminPrivileges(mockRequest, mockClaims, "https://example.atlassian.net", "123");

		expect(mockedGetJiraClient).toHaveBeenCalledWith("https://example.atlassian.net", "123", undefined);
		expect(mockJiraClient.permissions.checkAdmin).toHaveBeenCalledWith("1111");
		expect(mockRequest.session.isJiraAdmin).toBe(true);
		expect(mockRequest.log.info).toHaveBeenCalledWith({ isAdmin: true }, "Admin permissions set");
	});

	it("should not set isJiraAdmin if it already exists in the session", async () => {
		mockRequest.session.isJiraAdmin = "false";

		await setJiraAdminPrivileges(mockRequest, { sub: "1111" }, "https://example.atlassian.net", "123");

		expect(mockedGetJiraClient).not.toHaveBeenCalled();
		expect(mockRequest.session.isJiraAdmin).toBe("false");
	});

	it("should log an error if the Jira API call fails", async () => {
		mockRequest.session.isJiraAdmin = undefined;
		mockedGetJiraClient.mockRejectedValueOnce(new Error("Something went wrong"));

		await setJiraAdminPrivileges(mockRequest, { sub: "111" }, "https://example.atlassian.net", "123");

		expect(mockedGetJiraClient).toHaveBeenCalledWith("https://example.atlassian.net", "123", undefined);
		expect(mockRequest.log.error).toHaveBeenCalledWith({ err: new Error("Something went wrong") }, "Failed to fetch Jira Admin rights");
	});
});
