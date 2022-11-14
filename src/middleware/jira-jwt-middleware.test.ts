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

	it("should return a 401 when issuer missing in token", async () => {
		const req = buildRequest("secret", "");

		await jiraHostMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith({
			message: "JWT claim did not contain the issuer (iss) claim"
		});
		expect(next).toHaveBeenCalledTimes(0);
	});

	it("should return a 401 when no installation found", async () => {
		const req = buildRequest();

		await jiraHostMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith({
			message: "No Installation found"
		});
		expect(next).toHaveBeenCalledTimes(0);
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

	it("should return a 401 when token is wrong", async () => {

		jest.mocked(Installation.getForHost).mockResolvedValue(installation);

		const req = buildRequestWrongJwt(testSharedSecret);

		await jiraHostMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(next).toHaveBeenCalledTimes(0);
	});

	it("should return a 401 when secret is wrong", async () => {

		jest.mocked(Installation.getForHost).mockResolvedValue(installation);

		const req = buildRequestWrongJwt("wrong-secret");

		await jiraHostMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(next).toHaveBeenCalledTimes(0);
	});

});

describe("jiraJwtVerifyMiddleware", () => {
	let res;
	let next;
	let installation;

	beforeEach(async() => {
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

	it("should return a 401 when token missing", async () => {
		const req = buildRequestWithNoToken();

		await jiraJwtVerifyMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(res.json).toHaveBeenCalledWith({
			message: "Could not find authentication data on request"
		});
		expect(next).toHaveBeenCalledTimes(0);
	});

	it("should return a 401 when token is wrong", async () => {

		jest.mocked(Installation.getForHost).mockResolvedValue(installation);

		const req = buildRequestWrongJwt(testSharedSecret);

		await jiraHostMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(next).toHaveBeenCalledTimes(0);
	});

	it("should call next with a valid token and secret", async () => {
		jest.mocked(Installation.getForClientKey).mockResolvedValue(installation);
		const req = buildRequest(testSharedSecret);

		await jiraHostMiddleware(req, res, next);

		expect(next).toHaveBeenCalledWith();
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