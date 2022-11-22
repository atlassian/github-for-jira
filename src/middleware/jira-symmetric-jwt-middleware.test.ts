import { encodeSymmetric } from "atlassian-jwt";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";
import { getLogger } from "~/src/config/logger";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jira-symmetric-jwt-middleware";
import { Installation } from "~/src/models/installation";


const logger = getLogger("jira-jwt-verify-middleware.test");
jest.mock("config/feature-flags");
const testSharedSecret = "test-secret";

describe("jiraSymmetricJwtMiddleware", () => {
	let res;
	let next;
	//	let installation;

	beforeEach(async () => {
		res = {
			locals: {
			},
			status: jest.fn(),
			json: jest.fn(),
			send: jest.fn()
		};
		res.status.mockReturnValue(res);
		next = jest.fn();

		/* 	installation = {
			id: 19,
			jiraHost,
			clientKey: "jira-client-key",
			enabled: true,
			decrypt: jest.fn(() => testSharedSecret),
			subscriptions: jest.fn().mockResolvedValue([])
		}; */

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
		const req = buildRequestWithNoToken();

		await jiraSymmetricJwtMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.send).toBeCalledWith("Unauthorised");
		expect(next).toBeCalledTimes(0);
	});

	it("should throw error when issuer is missing in wrong", async () => {

		const req = buildRequest(testSharedSecret, "");

		await jiraSymmetricJwtMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.send).toBeCalledWith("Unauthorised");
		expect(next).toBeCalledTimes(0);
	});

	it("should throw error when no installation is found", async () => {

		const req = buildRequest(testSharedSecret, "jira-worng-key");

		await jiraSymmetricJwtMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.send).toBeCalledWith("Unauthorised");
		expect(next).toBeCalledTimes(0);
	});

	it("should call next with a valid token", async () => {
		const req = buildRequest(testSharedSecret);

		await jiraSymmetricJwtMiddleware(req, res, next);

		expect(next).toHaveBeenCalledWith();
	});

	it("should set res.locals and req.session with a valid token", async () => {
		const req = buildRequest(testSharedSecret);

		await jiraSymmetricJwtMiddleware(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.locals.installation.jiraHost).toEqual(jiraHost);
		expect(res.locals.jiraHost).toEqual(jiraHost);
		expect(req.session.jiraHost).toEqual(jiraHost);
	});

	it("should throw error when token is wrong", async () => {
		const req = buildRequest("wrong-secret");

		await jiraSymmetricJwtMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.send).toBeCalledWith("Unauthorised");
		expect(next).toBeCalledTimes(0);
	});

	it("should call next when jiraHost set in session", async () => {
		const req = buildRequestWithNoToken();
		req.session.jiraHost = jiraHost;

		await jiraSymmetricJwtMiddleware(req, res, next);

		expect(next).toHaveBeenCalledWith();
	});

	it("should set res.locals and req.session when jiraHost set in session", async () => {
		const req = buildRequestWithNoToken();
		req.session.jiraHost = jiraHost;

		await jiraSymmetricJwtMiddleware(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.locals.installation.jiraHost).toEqual(jiraHost);
		expect(res.locals.jiraHost).toEqual(jiraHost);
	});

});


const buildRequestWithNoToken = (): any => {
	return {
		query: {
		},
		addLogFields: jest.fn(),
		log: logger,
		session : { }
	};
};

const buildRequest = (secret = "secret", iss = "jira-client-key"): any => {
	const jwtValue = encodeSymmetric({
		qsh: "context-qsh",
		iss
	}, secret);

	return {
		query: {
			jwt: jwtValue
		},
		cookies: {
		},
		addLogFields: jest.fn(),
		log: logger,
		session: { }
	};
};