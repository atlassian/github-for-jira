/* eslint-disable @typescript-eslint/no-explicit-any */
import {encodeSymmetric} from "atlassian-jwt";
import { mocked } from "ts-jest/utils";
import { Installation } from "../../../src/models";
import {verifyJiraContextJwtTokenMiddleware} from "../../../src/frontend/verify-jira-jwt-middleware";
import logger from "../../../src/config/logger"

jest.mock("../../../src/models");

describe("#verifyJiraMiddleware", () => {
	let res;
	const next = jest.fn();
	let installation;
	let subscription;
	const testSharedSecret = "test-secret";

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

	describe("GET request", () => {
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
					jiraHost: subscription.jiraHost
				},
				addLogFields: jest.fn(),
				log: logger
			};
		};

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

		it("should return a 401 for an invalid jwt", async () => {
			mocked(Installation.getForHost).mockResolvedValue(installation);
			const req = buildRequest("good-host", "wrong-secret");

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(next).toBeCalledTimes(0)
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

		it("is unauthorized when token missing", async () => {
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

			mocked(Installation.getForHost).mockResolvedValue(installation);

			const req = buildRequestWithNoToken("host");

			await verifyJiraContextJwtTokenMiddleware(req, res, next);

			expect(res.status).toHaveBeenCalledWith(401)
			expect(next).toHaveBeenCalledTimes(0);
		});
	});
});
