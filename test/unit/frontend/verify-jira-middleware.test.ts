/* eslint-disable @typescript-eslint/no-explicit-any */
import {encodeSymmetric} from "atlassian-jwt";
import {mocked} from "ts-jest/utils";
import {Installation} from "../../../src/models";
import {verifyJiraContextJwtTokenMiddleware} from "../../../src/frontend/verify-jira-jwt-middleware";
import logger from "../../../src/config/logger"

jest.mock("../../../src/models");
jest.mock("../../../src/config/feature-flags");


describe("#verifyJiraMiddleware", () => {
	let res;
	let next;
	let installation;
	let subscription;
	const testSharedSecret = "test-secret";

	beforeEach(async () => {
		res = {
			locals: {},
			status: jest.fn(),
			json: jest.fn()
		};
		next = jest.fn();

		res.status.mockReturnValue(res)
		res.json.mockReturnValue(res)

		subscription = {
			githubInstallationId: 15,
			jiraHost: "https://test-host.jira.com",
			destroy: jest.fn().mockResolvedValue(undefined)
		};

		installation = {
			id: 19,
			jiraHost: subscription.jiraHost,
			clientKey: "abc123",
			enabled: true,
			secrets: "def234",
			sharedSecret: testSharedSecret,
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
				jiraHost: subscription.jiraHost,
				jwt: jwtValue
			},
			addLogFields: jest.fn(),
			log: logger
		};
	};

	const buildRequestWithNoToken = (jiraHost): any => {
		return {
			body: {
				jiraHost,
			},
			session: {
				jiraHost: subscription.jiraHost
			},
			query: {
				xdm_e: jiraHost,
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
				jiraHost: subscription.jiraHost,
				jwt: jwtValue
			},
			addLogFields: jest.fn(),
			log: logger
		};
	};

	describe("GET request", () => {

		it("should call next with a valid token and secret", async () => {
			mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("test-host", testSharedSecret);

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith();
		});

		it("sets res.locals to installation", async () => {
			mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("host", testSharedSecret);

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(res.locals.installation).toEqual(installation);
		});

		it("should return a 404 for an invalid installation", async () => {
			const req = buildRequest("host");

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith(new Error("Not Found"));
		});

		it("adds installation details to log", async () => {
			mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("host", testSharedSecret);
			const addLogFieldsSpy = jest.spyOn(req, "addLogFields");

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(addLogFieldsSpy).toHaveBeenCalledWith({
				jiraHost: installation.jiraHost,
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
					jiraHost,
				},
				session: {
					jiraHost: subscription.jiraHost
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
			mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("host", testSharedSecret);

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith();
		});

		it("is not found when host is missing", async () => {
			const req = buildRequest("host", testSharedSecret);

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith(new Error("Not Found"));
		});

	});

	it("should return a 401 for an undecodable jwt", async () => {
		mocked(Installation.getForHost).mockResolvedValue(installation);
		const req = buildRequest("good-host", "wrong-secret");

		await verifyJiraContextJwtTokenMiddleware(req, res, next);

		expect(next).toBeCalledTimes(0)
	});

	it("is unauthorized when token missing", async () => {

		mocked(Installation.getForHost).mockResolvedValue(installation);

		const req = buildRequestWithNoToken("host");

		await verifyJiraContextJwtTokenMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401)
		expect(next).toHaveBeenCalledTimes(0);
	});

	it("is unauthorized when token is wrong", async () => {

		mocked(Installation.getForHost).mockResolvedValue(installation);

		const req = buildRequestWrongJwt("host", testSharedSecret);

		await verifyJiraContextJwtTokenMiddleware(req, res, next);

		expect(res.status).toHaveBeenCalledWith(401)
		expect(next).toHaveBeenCalledTimes(0);
	});



});
