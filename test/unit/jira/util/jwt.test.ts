/* eslint-disable @typescript-eslint/no-explicit-any */
import {TokenType, verifySymmetricJwtTokenMiddleware} from "../../../../src/jira/util/jwt";
import logger from "../../../../src/config/logger"
import {encodeSymmetric} from "atlassian-jwt";

jest.mock("../../../../src/models");

describe("#verifySymmetricJwtTokenMiddleware", () => {

	let res;

	const next = jest.fn()

	const testSecret = "testSecret"

	const testRequestMethod = "GET"
	const testRequestPath = "/jira/configuration";
	const testQueryParams = {
		xdm_e: "https://kabakumov.atlassian.net",
		xdm_c: "channel-com.github.integration.konstantin__github-post-install-page",
		cp: "",
		xdm_deprecated_addon_key_do_not_use: "com.github.integration.konstantin",
		lic: "none",
		cv: "1001.0.0-SNAPSHOT"
	}

	const baseRequest = {
		query: testQueryParams,
		method: testRequestMethod,
		path: testRequestPath,
		session: {
			jiraHost: "https://test.atlassian.net"
		},
		addLogFields: jest.fn(),
		log: logger
	}

	//Query string hash corresponding to the request parameters above
	const testQsh = "345c5da1c34c5126155b18ff4522446c89cc017debe4878bfa6056cacd5245ae"


	beforeEach(async () => {
		res = {
			locals: {},
			status: jest.fn(),
			json: jest.fn()
		};

		res.status.mockReturnValue(res)
		res.json.mockReturnValue(res)
	});

	const buildRequest = (secret = "secret", qsh: string): any => {
		const jwtValue = encodeSymmetric({
			qsh: qsh,
			iss: "jira",
		}, secret);

		return {
			...baseRequest,
			query: {
				...testQueryParams,
				jwt: jwtValue
			},
			method: testRequestMethod,
			path: testRequestPath,
		};
	};

	describe("Normal Token", () => {
		it("should pass when token is valid", async () => {

			const req = buildRequest(testSecret, testQsh);

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.normal, req, res, next)

			expect(res.status).toHaveBeenCalledTimes(0)
			expect(next).toBeCalledTimes(1)

		});


		it("should fail if qsh don't match", async () => {

			const req = buildRequest(testSecret, "q123123124");

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.normal, req, res, next)

			expect(res.status).toHaveBeenCalledWith(401)
			expect(next).toBeCalledTimes(0)

		});

		it("should fail if secret is wrong", async () => {

			const req = buildRequest("wrongSecret", testQsh);

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.normal, req, res, next)

			expect(res.status).toHaveBeenCalledWith(400)
			expect(next).toBeCalledTimes(0)

		});
	});

	describe("Context Token", () => {

		it("should pass if qsh is 'context-qsh'", async () => {

			const req = buildRequest(testSecret, "context-qsh");

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next)

			expect(res.status).toHaveBeenCalledTimes(0)
			expect(next).toBeCalledTimes(1)

		});

		it("should fail if there is a proper qsh", async () => {

			const req = buildRequest(testSecret, testQsh);

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next)

			expect(res.status).toHaveBeenCalledWith(401)
			expect(next).toBeCalledTimes(0)

		});


		it("should fail if qsh is not valid", async () => {

			const req = buildRequest(testSecret, "q123123124");

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next)

			expect(res.status).toHaveBeenCalledWith(401)
			expect(next).toBeCalledTimes(0)

		});

		it("should fail if secret is wrong", async () => {

			const req = buildRequest("wrongSecret", testQsh);

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next)

			expect(res.status).toHaveBeenCalledWith(400)
			expect(next).toBeCalledTimes(0)

		});
	});

	describe("Expiry date", () => {

		const buildRequest = (expiryDate: number): any => {
			const jwtValue = encodeSymmetric({
				qsh: "context-qsh",
				iss: "jira",
				exp: expiryDate
			}, testSecret);

			return {
				...baseRequest,
				query: {
					...testQueryParams,
					jwt: jwtValue
				},
			};
		};

		it("should pass if expiry date after current date", async () => {

			const req = buildRequest(Date.now() / 1000 + 100000);

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next)

			expect(res.status).toHaveBeenCalledTimes(0)
			expect(next).toBeCalledTimes(1)

		});

		it("should fail if expiry date before current date", async () => {

			const req = buildRequest(Date.now() / 1000 - 100000);

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next)

			expect(res.status).toHaveBeenCalledWith(401)
			expect(next).toBeCalledTimes(0)
		});
	})

	describe("Token in different places", () => {
		const buildRequestWithTokenInBody = (): any => {
			const jwtValue = encodeSymmetric({
				qsh: "context-qsh",
				iss: "jira",
			}, testSecret);

			return {
				...baseRequest,
				method: "POST",
				body: {
					jwt: jwtValue
				},
			};
		};

		it("Passes if token is in body", async () => {

			const req = buildRequestWithTokenInBody();

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next)

			expect(res.status).toHaveBeenCalledTimes(0)
			expect(next).toBeCalledTimes(1)
		});

		const buildRequestWithTokenInHeader = (): any => {
			const jwtValue = encodeSymmetric({
				qsh: "context-qsh",
				iss: "jira",
			}, testSecret);

			return {
				...baseRequest,
				query: testQueryParams,
				method: "POST",
				headers: {
					authorization: `JWT ${jwtValue}`
				},
			};
		};

		it("Passes if token is in header", async () => {

			const req = buildRequestWithTokenInHeader();

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next)

			expect(res.status).toHaveBeenCalledTimes(0)
			expect(next).toBeCalledTimes(1)
		});

		const buildRequestWithNoToken = (): any => {
			return {
				...baseRequest,
			};
		};

		it("Fails if there is no token", async () => {

			const req = buildRequestWithNoToken();

			verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next)

			expect(res.status).toHaveBeenCalledWith(401)
			expect(next).toBeCalledTimes(0)
		});

	});

});
