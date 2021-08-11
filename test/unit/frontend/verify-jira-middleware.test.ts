/* eslint-disable @typescript-eslint/no-explicit-any */
import {encodeSymmetric} from "atlassian-jwt";
import {mocked} from "ts-jest/utils";
import {Installation} from "../../../src/models";
import {verifyJiraContextJwtTokenMiddleware} from "../../../src/frontend/verify-jira-jwt-middleware";
import logger from "../../../src/config/logger"
import {booleanFlag, BooleanFlags} from "../../../src/config/feature-flags";
import {when} from "jest-when";

jest.mock("../../../src/models");
jest.mock("../../../src/config/feature-flags");


describe("#verifyJiraMiddleware", () => {
	let res;
	const next = jest.fn();
	let installation;
	let subscription;
	const testSharedSecret = "test-secret";

	const whenJwtFixApplied = (value: boolean) =>
		when(booleanFlag).calledWith(
			BooleanFlags.FIX_IFRAME_ENDPOINTS_JWT,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(value);

	beforeEach(async () => {
		res = {
			locals: {},
			status: jest.fn(),
			json: jest.fn()
		};

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

	//Tests which should pass regardless if USE_JWT_SIGNED_INSTALL_CALLBACKS feature flag is on or off
	const commonTests = () => {
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


	describe("When Fix Applied", () => {
		beforeEach(async () => {
			whenJwtFixApplied(true)
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

		commonTests()
	});

	describe("When Fix Not Applied", () => {
		beforeEach(async () => {
			whenJwtFixApplied(false)
		});

		it("should throw an error for an undecodable jwt", async () => {
			mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("good-host", "wrong-secret");

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith(new Error("Unauthorized"))
		});

		it("is unauthorized when token missing", async () => {
			mocked(Installation.getForHost).mockResolvedValue(installation);

			const req = buildRequestWithNoToken("host");

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toHaveBeenCalledWith(new Error("Unauthorized"))
		});

		//This test is here to make sure that if feature flag is OFF then the behaviour will remain as it is right now
		it("authorisation passed when token is wrong but decodable", async () => {

			mocked(Installation.getForHost).mockResolvedValue(installation);

			const req = buildRequestWrongJwt("host", testSharedSecret);

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(res.status).toHaveBeenCalledTimes(0)
			expect(next).toHaveBeenCalledWith();
		});

		commonTests()
	});

});
