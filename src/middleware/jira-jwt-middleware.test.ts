import { encodeSymmetric } from "atlassian-jwt";
import { getLogger } from "~/src/config/logger";
import { jiraJwtVerifyMiddleware, jiraHostMiddleware } from "~/src/middleware/jira-jwt-middleware";
import { Installation } from "~/src/models/installation";


const logger = getLogger("jira-jwt-verify-middleware.test");
jest.mock("models/installation");
const testSharedSecret = "test-secret";
describe("jiraHostMiddleware", () => {
	let res;
	let next;
	let installation;

	beforeEach(async () => {
		res = {
			locals: {
			},
			status: jest.fn(),
			json: jest.fn()
		};
		res.status.mockReturnValue(res);
		next = jest.fn();

		installation = {
			id: 19,
			jiraHost,
			clientKey: "abc123",
			enabled: true,
			decrypt: jest.fn(() => testSharedSecret),
			subscriptions: jest.fn().mockResolvedValue([])
		};

	});

	it("should call next with a valid token and secret", async () => {
		jest.mocked(Installation.getForClientKey).mockResolvedValue(installation);
		const req = buildRequest(testSharedSecret);

		await jiraHostMiddleware(req, res, next);

		expect(next).toHaveBeenCalledWith();
	});

	it("should set res.locals", async () => {
		jest.mocked(Installation.getForClientKey).mockResolvedValue(installation);
		const req = buildRequest(testSharedSecret);

		await jiraHostMiddleware(req, res, next);

		expect(next).toHaveBeenCalledTimes(1);
		expect(res.locals.installation).toEqual(installation);
		expect(res.locals.jiraHost).toEqual(installation.jiraHost);
	});

});

describe("jiraJwtVerifyMiddleware", () => {
	let res;
	let next;
	let installation;

	beforeEach(async () => {
		res = {
			locals: {
			},
			status: jest.fn(),
			json: jest.fn()
		};
		res.status.mockReturnValue(res);
		next = jest.fn();

		installation = {
			id: 19,
			jiraHost,
			clientKey: "abc123",
			enabled: true,
			decrypt: jest.fn(() => testSharedSecret),
			subscriptions: jest.fn().mockResolvedValue([])
		};
	});

	it("should throw error when token missing", async () => {
		const req = buildRequestWithNoToken();

		await jiraJwtVerifyMiddleware(req, res, next);

		expect(next).toHaveBeenCalledWith(new Error("Could not find authentication data on request"));
	});

	it("should throw error when token is wrong", async () => {

		jest.mocked(Installation.getForHost).mockResolvedValue(installation);

		const req = buildRequestWrongJwt(testSharedSecret);

		await jiraJwtVerifyMiddleware(req, res, next);

		expect(next).toHaveBeenCalledWith(new Error("No Installation found"));
	});

	it("should call next with a valid token and secret", async () => {
		jest.mocked(Installation.getForClientKey).mockResolvedValue(installation);
		const req = buildRequest(testSharedSecret);

		await jiraJwtVerifyMiddleware(req, res, next);

		expect(next).toHaveBeenCalledWith();
	});

	it("should throw error when issuer missing in token", async () => {
		const req = buildRequest("secret", "");

		await jiraJwtVerifyMiddleware(req, res, next);

		expect(next).toHaveBeenCalledWith(new Error("JWT claim did not contain the issuer (iss) claim"));
	});

	it("should throw error when no installation found", async () => {
		const req = buildRequest();

		await jiraJwtVerifyMiddleware(req, res, next);

		expect(next).toHaveBeenCalledWith(new Error("No Installation found"));
	});

});

const buildRequestWithNoToken = (): any => {
	return {
		query: {
		},
		addLogFields: jest.fn(),
		log: logger
	};
};

const buildRequestWrongJwt = (secret = "secret"): any => {
	const jwtValue = encodeSymmetric({
		qsh: "12435-wrong-qsh",
		exp: 0,
		iss: "jira"
	}, secret);

	return {
		query: {
			jwt: jwtValue
		},
		addLogFields: jest.fn(),
		log: logger
	};
};

const buildRequest = (secret = "secret", iss = "jira"): any => {
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
		log: logger
	};
};