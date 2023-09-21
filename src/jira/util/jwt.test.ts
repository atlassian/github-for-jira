/* eslint-disable @typescript-eslint/no-explicit-any */
import { createCanonicalRequest as jwtCreateCanonicalRequest, createQueryStringHash as jwtCreateQueryStringHash, getJWTRequest, JWTRequest, TokenType, validateAsymmetricJwtTokenMiddleware, verifySymmetricJwtTokenMiddleware } from "./jwt";
import { AsymmetricAlgorithm, createCanonicalRequest, createQueryStringHash, encodeAsymmetric, encodeSymmetric } from "atlassian-jwt";
import { queryAtlassianConnectPublicKey } from "./query-atlassian-connect-public-key";
import { when } from "jest-when";
import { Request, Response } from "express";
import { getLogger } from "config/logger";
import Mock = jest.Mock;

jest.mock("./query-atlassian-connect-public-key");

describe("jwt", () => {
	let testQueryParams: Record<string, string>;
	let res: Response;
	let baseRequest: Request;

	let next: Mock;
	const testSecret = "testSecret";

	// Query string hash corresponding to the request parameters above
	const testQsh = "bcb1e97709b6bcbce5b08cabffe01050e13edabb7a64efbd45ee15ee4b6494d9";

	// RAS keypair used to sign test tokens. Base64 encoded to prevent security scanning from being triggered
	const testPrivateKey = Buffer.from(
		"LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlDWFFJQkFBS0JnUUROL2ZXZXg5dXJ2VHRYWGY0aVlodmU0akJDaDg2Uk4zUHc5YW1SaVovU241TTdlY1JzCjNWZE5TR2FvRGNEZG1MaEYzczZkTUVlN2ZzTW9SVXZ3cit0VnoyL2JpSDBLOTh4dlFETzhaNHd3ZlRKbjNHSE8Kamg2Nk5YcE5lRDhobzBrMFllZXcveHBGMGU0cys4Tkg2b0Jna09OMTJoS29mQ2FQOEFDeXViYk93UUlEQVFBQgpBb0dBSDM2SW96SWpYK3FhdkF6ZTRocmw3L25kTHc3Y2drOWNKcWNvdWR1MDE5c1dBNjNtWGs2cEhtUEhia0pNCkRwVmU5eS9ObnpMV2hOQW92bXQ1NU43QXVDTzJaQm1pWXROY1BCckU0aUVXN1NDMjlZOEFOKzBvTHVYTmt6OFAKVURJeUVsWFRNakJ5cFZpN3RNellKaFlOM1FhMWdVVnR2TmNDN0t0WW95cXVWd0VDUVFEcXN6VktwYlNwNVMyRgpEdU5nYlVsaTdCMDgwakNTRlJ4dkQ5ek9WdmkxckRVSC9aV1JHcDFDaFE0TUdYR2FoQWxJaUVLNklFMVYxR1NpCmhJZFY0Q01KQWtFQTRLL0hDN09vdTBiU3hhVVVqclVTMmYzRzE5Tk1TNHIrbXhLZ2s4UnBFWWMzVzJpRjB3eDkKUHNCYlVkbGlyRVVHaUpLWEdXNTNPLzRTQUptOTlMYWorUUpCQUw4RFgwb0Rsd2YyNTVjMVNNVC83UXcva29RZgpwVHdmUm1iMWlBVy9MdWZjNGNSQkZHdG1ON3Nkd3hNQjJqMmhYRlRWNFVqT1pXS0hXK2dRNkh4eDBORUNRQS85CmNuVHF2RDlYc3ZoTjMwQ29za2JCUUwxclZDcXNJYUozbU9YclBHNzY2SDJnMnFWQ1prZG8rUmJDR2J1WXpmWTYKT0hhZTNlMXZEMmpyaUJFNlRrRUNRUUNGNXpndDlhSHlzeDJwQmJTcjlCZVdTdFExdUJlcEpSajh5Skg2NisyYQpaR1ZJOEY2Tk9HaERSRDhwakZrclcydXdoemhDbkZ4U2Nza3FVWm1BcHBuUwotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQ==",
		"base64"
	).toString("ascii");

	const testPublicKey = Buffer.from(
		"LS0tLS1CRUdJTiBQVUJMSUMgS0VZLS0tLS0KTUlHZk1BMEdDU3FHU0liM0RRRUJBUVVBQTRHTkFEQ0JpUUtCZ1FETi9mV2V4OXVydlR0WFhmNGlZaHZlNGpCQwpoODZSTjNQdzlhbVJpWi9TbjVNN2VjUnMzVmROU0dhb0RjRGRtTGhGM3M2ZE1FZTdmc01vUlV2d3IrdFZ6Mi9iCmlIMEs5OHh2UURPOFo0d3dmVEpuM0dIT2poNjZOWHBOZUQ4aG8wazBZZWV3L3hwRjBlNHMrOE5INm9CZ2tPTjEKMmhLb2ZDYVA4QUN5dWJiT3dRSURBUUFCCi0tLS0tRU5EIFBVQkxJQyBLRVktLS0tLQ==",
		"base64"
	).toString("ascii");

	const wrongPrivateKey = Buffer.from(
		"LS0tLS1CRUdJTiBSU0EgUFJJVkFURSBLRVktLS0tLQpNSUlDV3dJQkFBS0JnRlVCSkFUdDJyd0M4NUtvdmM5eC9DYnZmTWdiRUw4UGorRmRlNUpENjJsK3B1WENJejk1CkJPMzIvUG9JNE5SNnZzWVhJN213UmsyV1A1VGV5dkxXVjFTYS9IekFqbWQxQzVlbGVJNkM5dERjYXVxU2VpR1UKQ2FTS0JVTkhmS3VBK0pCSi9GYUlZMWphTE1peGxCa09uYnNNZ1hxb0ZHSUtzZGhhMnBKaXJ6QXBBZ01CQUFFQwpnWUFFYmtMS1h2dC93VWVnNVZxL2JWbVBUZnhiRWM0VnAySUFoVGJqc05hY2NSV1I5RVNTRW1USFlwQmRHQWxnCkNlWFh2VzBIU01EaFdtdUYvdmJsSVhiN3lvd1JOSkxNVmpoYldScHU1dE1uVmErS0U3eDYrbFJjMzJ1dVVXYkkKL1MwdnJsTVJWYlZjYThqVGxLS1VsV0draWJzMWlhMVMvWlBmWFlqKzc5Ym9BUUpCQUo4c1lVcm9DK0ozR0k0TQovZmFHWUg3UWNGcm1HQm41YThZVVVJUTJYQnpwL1NmOU1CNTdpbnJzN2xTSHhrczk3QjNSNFkxOGMxclB0dXJECmZaWUxzK0VDUVFDSXRxVk54OXordmxpY3JyWTVqTUU5VUNjOGU0MTJnLzI2VHFVSzFnVEFoWVI3SHZObE5QeHoKUFlDZnUrVU5QK09wd2owQ1pkSktwYzZZMU13eGhZVkpBa0IvYlZZT1U2cUFDSHdkN0lTOEFXUHE0Zyt3bFpnaAo0eTNHaTZqUnozcjZvdEJLWFVWU2dmQ2c3R0Q0UnlJV1JtSnFsUVdPOFZ5Z0RMNFJQNk9ncFluQkFrQSs1eHJECjRQUFQyaXpYV3FQSmN2UHVqQlNoaFkrZk9qZmlJeEZaSFFQdXVRQXR6aDNiTVRmK3BndXFjejkraXlqckVNNFYKYmxnRnRLaU1OVTBHZEJMUkFrRUFsa1FxcjFiK3VKZG1PdHVFQmtEb09VeERvcmx6VkhtTVhwMjBKSjEyTm1KTgpOV1RDZm44YWs1c1lEdEZ1eEtCV3JPcEJVOXA2cEF6blVRR0hzaHI0N1E9PQotLS0tLUVORCBSU0EgUFJJVkFURSBLRVktLS0tLQ==",
		"base64"
	).toString("ascii");
	const testKid = "1234435235352";

	const buildRequestWithNoToken = () => baseRequest;

	const buildRequest = (jwtValue: string) => {
		const query = {
			...testQueryParams,
			jwt: jwtValue
		};
		return {
			...baseRequest,
			query,
			method: "GET",
			pathname: "/jira/configuration",
			url: `/jira/configuration?${new URLSearchParams(query).toString()}`
		};
	};

	const buildRequestWithJwt = (secret = "secret", qsh: string): any =>
		buildRequest(
			encodeSymmetric({
				qsh: qsh,
				iss: "jira"
			}, secret)
		);

	beforeEach(async () => {
		next = jest.fn();
		// TODO: need to create a route with express Router and use supertest to actually
		// test the real flow instead of mocking everything based on the assumption that
		// we know exactly how express is going to behave
		res = {
			locals: {},
			status: jest.fn(),
			json: jest.fn()
		} as any;

		(res.status as Mock).mockReturnValue(res);
		(res.json as Mock).mockReturnValue(res);

		testQueryParams = {
			xdm_e: "https://test.atlassian.net",
			xdm_c: "channel-com.github.integration.test__github-post-install-page",
			cp: "",
			xdm_deprecated_addon_key_do_not_use: "com.github.integration.test",
			lic: "none",
			cv: "1001.0.0-SNAPSHOT"
		};

		baseRequest = {
			query: testQueryParams,
			method: "GET",
			pathname: "/jira/configuration",
			session: {
				jiraHost: "https://test.atlassian.net"
			},
			url: `/jira/configuration?${new URLSearchParams(testQueryParams).toString()}`,
			log: getLogger("jwt.test")
		} as any;

	});

	describe("#verifySymmetricJwtTokenMiddleware", () => {

		describe("Normal Token", () => {
			it("should pass when token is valid", async () => {
				const req = buildRequestWithJwt(testSecret, testQsh);
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.normal, req, res, next);
				expect(res.status).toHaveBeenCalledTimes(0);
				expect(next).toBeCalledTimes(1);
			});

			it("should fail if qsh don't match", async () => {
				const req = buildRequestWithJwt(testSecret, "q123123124");
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.normal, req, res, next);
				expect(res.status).toHaveBeenCalledWith(401);
				expect(next).toBeCalledTimes(0);
			});

			it("should fail if secret is wrong", async () => {
				const req = buildRequestWithJwt("wrongSecret", testQsh);
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.normal, req, res, next);
				expect(res.status).toHaveBeenCalledWith(401);
				expect(next).toBeCalledTimes(0);
			});
		});

		describe("Context Token", () => {

			it("should pass if qsh is 'context-qsh'", async () => {
				const req = buildRequestWithJwt(testSecret, "context-qsh");
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledTimes(0);
				expect(next).toBeCalledTimes(1);
			});

			it("should fail if there is a proper qsh", async () => {
				const req = buildRequestWithJwt(testSecret, testQsh);
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledWith(401);
				expect(next).toBeCalledTimes(0);
			});


			it("should fail if qsh is not valid", async () => {
				const req = buildRequestWithJwt(testSecret, "q123123124");
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledWith(401);
				expect(next).toBeCalledTimes(0);

			});

			it("should fail if secret is wrong", async () => {
				const req = buildRequestWithJwt("wrongSecret", testQsh);
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledWith(401);
				expect(next).toBeCalledTimes(0);
			});
		});

		describe("Expiry date", () => {
			const buildRequest = (expiryDate: number): any => {
				const jwtValue = encodeSymmetric({
					qsh: "context-qsh",
					iss: "jira",
					exp: expiryDate
				}, testSecret);

				const query = {
					...testQueryParams,
					jwt: jwtValue
				};
				return {
					...baseRequest,
					query,
					url: `/jira/configuration?${new URLSearchParams(query).toString()}`
				};
			};

			it("should pass if expiry date after current date", async () => {
				const req = buildRequest(Date.now() / 1000 + 100000);
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledTimes(0);
				expect(next).toBeCalledTimes(1);
			});

			it("should fail if expiry date before current date", async () => {
				const req = buildRequest(Date.now() / 1000 - 100000);
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledWith(401);
				expect(next).toBeCalledTimes(0);
			});
		});

		describe("Token in different places", () => {
			const buildRequestWithTokenInBody = (): any => {
				const jwtValue = encodeSymmetric({
					qsh: "context-qsh",
					iss: "jira"
				}, testSecret);

				return {
					...baseRequest,
					method: "POST",
					body: {
						jwt: jwtValue
					}
				};
			};

			it("Passes if token is in body", async () => {
				const req = buildRequestWithTokenInBody();
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledTimes(0);
				expect(next).toBeCalledTimes(1);
			});

			const buildRequestWithTokenInHeader = (): any => {
				const jwtValue = encodeSymmetric({
					qsh: "context-qsh",
					iss: "jira"
				}, testSecret);

				return {
					...baseRequest,
					query: testQueryParams,
					method: "POST",
					headers: {
						authorization: `JWT ${jwtValue}`
					}
				};
			};

			const buildRequestWithTokenInCookie = (): any => {
				const jwtValue = encodeSymmetric({
					qsh: "context-qsh",
					iss: "jira"
				}, testSecret);

				return {
					...baseRequest,
					query: testQueryParams,
					method: "POST",
					headers: {},
					cookies: {
						jwt: jwtValue
					}
				};
			};

			it("Passes if token is in header", async () => {
				const req = buildRequestWithTokenInHeader();
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledTimes(0);
				expect(next).toBeCalledTimes(1);
			});

			it("Passes if token is in cookies", async () => {
				const req = buildRequestWithTokenInCookie();
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledTimes(0);
				expect(next).toBeCalledTimes(1);
			});

			it("Token in headers has priority over token in cookies", async () => {
				const req = buildRequestWithTokenInHeader();
				req.cookies = {
					jwt: "JWT boom"
				};
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).not.toBeCalled();
				expect(next).toBeCalledTimes(1);
			});

			it("Fails if there is no token", async () => {
				const req = buildRequestWithNoToken();
				verifySymmetricJwtTokenMiddleware(testSecret, TokenType.context, req, res, next);
				expect(res.status).toHaveBeenCalledWith(401);
				expect(next).toBeCalledTimes(0);
			});
		});
	});

	describe("#verifyAsymmetricJwtTokenMiddleware", () => {
		beforeEach(async () => {
			when(queryAtlassianConnectPublicKey).calledWith(
				testKid,
				expect.anything()
			).mockResolvedValue(testPublicKey);
		});

		const buildRequestWithJwtPayload = (jwtPayload: any, key ?: string): any => {
			key = key || testPrivateKey;
			const jwtValue = encodeAsymmetric(jwtPayload, key, AsymmetricAlgorithm.RS256,
				{
					kid: "1234435235352"
				});
			return buildRequest(jwtValue);
		};

		const buildRequestWithJwt = (qsh: string, exp ?: number, key ?: string): any => {
			exp = exp || Date.now() / 1000 + 100000;
			return buildRequestWithJwtPayload({
				qsh: qsh,
				exp: exp,
				iss: "jira",
				aud: "https://test-github-app-instance.com"
			}, key);
		};

		it("should pass when token is valid", async () => {
			const req = buildRequestWithJwt(testQsh);
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledTimes(0);
			expect(next).toBeCalledTimes(1);
			expect(queryAtlassianConnectPublicKey).toHaveBeenCalledWith(testKid, false);
		});

		it("should pass when token is valid for Staging Jira Instance", async () => {
			const req = buildRequestWithJwt(testQsh);
			req.body = { baseUrl: "https://test.jira-dev.com/jira/your-work" };
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledTimes(0);
			expect(next).toBeCalledTimes(1);
			expect(queryAtlassianConnectPublicKey).toHaveBeenCalledWith(testKid, true);
		});

		it("should pass when token is valid for Prod Jira Instance", async () => {
			const req = buildRequestWithJwt(testQsh);
			req.body = { baseUrl: "https://test.atlassian.net" };
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledTimes(0);
			expect(next).toBeCalledTimes(1);
			expect(queryAtlassianConnectPublicKey).toHaveBeenCalledWith(testKid, false);
		});

		it("should return 401 when was encrypted with wrong key", async () => {
			const req = buildRequestWithJwt(testQsh, undefined, wrongPrivateKey);
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledWith(401);
			expect(next).toBeCalledTimes(0);
		});

		it("should return 401 when when call fails with Not Found", async () => {
			const req = buildRequestWithJwt(testQsh);
			when(queryAtlassianConnectPublicKey).calledWith(
				testKid,
				false
			).mockRejectedValueOnce(new Error("404"));
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledWith(401);
			expect(next).toBeCalledTimes(0);
		});

		it("should return 401 when expiration date is wrong", async () => {
			const req = buildRequestWithJwt(testQsh, Date.now() / 1000 - 100);
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledWith(401);
			expect(next).toBeCalledTimes(0);
		});

		it("should return 401 when qsh is wrong", async () => {
			const req = buildRequestWithJwt("13113wrong13123");
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledWith(401);
			expect(next).toBeCalledTimes(0);
		});

		it("should return 401 when no audience", async () => {
			const req = buildRequestWithJwtPayload({
				qsh: testQsh,
				iss: "jira"
			});
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledWith(401);
			expect(next).toBeCalledTimes(0);
		});

		it("should return 401 when wrong audience", async () => {
			const req = buildRequestWithJwtPayload({
				qsh: testQsh,
				iss: "jira",
				aud: "https://wrong-addon.example.com"
			});
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledWith(401);
			expect(next).toBeCalledTimes(0);
		});

		it("should return 200 with encoded URI in the path", async () => {
			const req = buildRequestWithJwt("bcb1e97709b6bcbce5b08cabffe01050e13edabb7a64efbd45ee15ee4b6494d9");
			req.path = encodeURIComponent("https://whatever.fake");
			await validateAsymmetricJwtTokenMiddleware(req, res, next);
			expect(res.status).toHaveBeenCalledTimes(0);
			expect(next).toBeCalledTimes(1);
		});
	});

	describe("Make sure our jwt API returns the same data as atlassian-jwt", () => {
		let request: Request;
		let jwtRequest: JWTRequest;
		beforeEach(() => {
			request = buildRequestWithJwt(testSecret, testQsh);
			jwtRequest = getJWTRequest(request);
		});

		it("should return the same qsh", () => {
			expect(jwtCreateQueryStringHash(jwtRequest)).toEqual(createQueryStringHash(request));
			expect(jwtCreateQueryStringHash(jwtRequest, true)).toEqual(createQueryStringHash(request, true));
		});

		it("should return the same request string", () => {
			expect(jwtCreateCanonicalRequest(jwtRequest)).toEqual(createCanonicalRequest(request));
		});
	});
});
