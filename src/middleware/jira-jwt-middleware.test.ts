/* eslint-disable @typescript-eslint/no-explicit-any */
import { encodeSymmetric } from "atlassian-jwt";
import { Installation } from "models/installation";
import { JiraContextJwtTokenMiddleware } from "./jira-jwt-middleware";
import { getLogger } from "config/logger";

const logger = getLogger("jwt-middleware.test");
jest.mock("models/installation");

jest.mock("config/feature-flags", ()=>({
	...jest.requireActual("config/feature-flags"),
	booleanFlag: jest.fn()
}));

describe("#verifyJiraMiddleware", () => {
	let res;
	let next;
	let installation;
	const testSharedSecret = "test-secret";

	beforeEach(async () => {
		res = {
			locals: {
				jiraHost
			},
			status: jest.fn(),
			json: jest.fn()
		};
		next = jest.fn();

		res.status.mockReturnValue(res);
		res.json.mockReturnValue(res);

		installation = {
			id: 19,
			jiraHost,
			clientKey: "abc123",
			enabled: true,
			decrypt: jest.fn(() => testSharedSecret),
			subscriptions: jest.fn().mockResolvedValue([])
		};
	});

	const buildRequest = (jiraHost, secret = "secret"): any => {
		const jwtValue = encodeSymmetric({
			qsh: "context-qsh",
			iss: "jira"
		}, secret);

		return {
			query: {
				xdm_e: jiraHost,
				jwt: jwtValue
			},
			session: {
				// jiraHost,
				jwt: jwtValue
			},
			addLogFields: jest.fn(),
			log: logger
		};
	};

	const buildRequestWithNoToken = (jiraHost): any => {
		return {
			body: {
				jiraHost
			},
			query: {
				xdm_e: jiraHost
			},
			addLogFields: jest.fn(),
			log: logger
		};
	};

	const buildRequestWrongJwt = (jiraHost, secret = "secret"): any => {
		const jwtValue = encodeSymmetric({
			qsh: "12435-wrong-qsh",
			exp: 0,
			iss: "jira"
		}, secret);

		return {
			query: {
				xdm_e: jiraHost,
				jwt: jwtValue
			},
			session: {
				jwt: jwtValue
			},
			addLogFields: jest.fn(),
			log: logger
		};
	};

	describe("GET request", () => {

		it("should call next with a valid token and secret", async () => {
			jest.mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("test-host", testSharedSecret);

			await JiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith();
		});

		it("sets res.locals to installation", async () => {
			jest.mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("host", testSharedSecret);

			await JiraContextJwtTokenMiddleware(req, res, next);

			expect(res.locals.installation).toEqual(installation);
		});

		it("should return a 404 for an invalid installation", async () => {
			const req = buildRequest("host");

			await JiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith(new Error("Not Found"));
		});

		it("adds installation details to log", async () => {
			jest.mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("host", testSharedSecret);
			const logChildSpy = jest.spyOn(req, "addLogFields");

			await JiraContextJwtTokenMiddleware(req, res, next);

			expect(logChildSpy).toHaveBeenCalledWith({
				jiraHost,
				jiraClientKey: "abc12***" // should be the shortened key
			});
		});
	});

	describe("POST request", () => {
		const buildRequest = (jiraHost, secret): any => {
			const encodedJwt = secret && encodeSymmetric({
				qsh: "context-qsh",
				iss: "jira"
			}, secret);

			return {
				body: {
					jiraHost
				},
				query: {
					xdm_e: jiraHost,
					jwt: encodedJwt
				},
				addLogFields: jest.fn(),
				log: logger
			};
		};

		it("pulls jiraHost and token from body", async () => {
			jest.mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("host", testSharedSecret);

			await JiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith();
		});

		it("is not found when host is missing", async () => {
			const req = buildRequest("host", testSharedSecret);

			await JiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith(new Error("Not Found"));
		});

	});

	describe("decyrpting installation encryptedSharedSecret", ()=>{
		let installation: Installation;
		beforeEach(()=>{
			installation = {
				id: 19,
				jiraHost,
				clientKey: "abc123",
				decrypt: async (f: string) => f === "encryptedSharedSecret" ? "new-cryptor-shared-secret" : null
			} as any as Installation;
		});
		it("should read new field (encryptedSharedSecret) via decrypt method", async () => {
			jest.mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest(jiraHost, "new-cryptor-shared-secret");
			await JiraContextJwtTokenMiddleware(req, res, next);
			expect(next).toBeCalled();
		});
	});

	it("should return a 401 for an undecodable jwt", async () => {
		jest.mocked(Installation.getForHost).mockResolvedValue(installation);
		const req = buildRequest("good-host", "wrong-secret");

		await JiraContextJwtTokenMiddleware(req, res, next);

		expect(next).toBeCalledTimes(0);
	});

	it("is unauthorized when token missing", async () => {

		jest.mocked(Installation.getForHost).mockResolvedValue(installation);

		const req = buildRequestWithNoToken("host");

		await JiraContextJwtTokenMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(next).toHaveBeenCalledTimes(0);
	});

	it("is unauthorized when token is wrong", async () => {

		jest.mocked(Installation.getForHost).mockResolvedValue(installation);

		const req = buildRequestWrongJwt("host", testSharedSecret);

		await JiraContextJwtTokenMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401);
		expect(next).toHaveBeenCalledTimes(0);
	});

});
