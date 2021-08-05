/* eslint-disable @typescript-eslint/no-explicit-any */
import jwt from "atlassian-jwt";
import {hasValidJwt, TokenType} from "../../../../src/jira/util/jwt";

jest.mock("../../../../src/models");

describe("#hasValidJwt", () => {

	let res;
	const testRequestMethod = "GET"
	const testRequestPath = '/jira/configuration';
	const testQueryParams = {
		xdm_e: "https://kabakumov.atlassian.net",
		xdm_c: "channel-com.github.integration.konstantin__github-post-install-page",
		cp: "",
		xdm_deprecated_addon_key_do_not_use: "com.github.integration.konstantin",
		lic: "none",
		cv: "1001.0.0-SNAPSHOT"
	}

	//Query string hash corresponding to the request parameters above
	const testQsh = "345c5da1c34c5126155b18ff4522446c89cc017debe4878bfa6056cacd5245ae"




	beforeEach(async () => {
		res = {
			locals: {},
			status: jest.fn()
		};
	});




	describe("Normal Token", () => {
		const buildRequest = (secret = "secret", qsh: string): any => {
			const jwtValue = jwt.encode(`{
  			"qsh": "${qsh}",
  			"iss": "jira",
			}`, secret);

			return {
				query: {
					...testQueryParams,
					jwt: jwtValue
				},
				method: testRequestMethod,
				pathname: testRequestPath,
				session: {
					jiraHost: jiraHost
				},
				addLogFields: jest.fn()
			};
		};

		it("should pass when token is valid", async () => {

			const req = buildRequest("secret", testQsh);
			jwt.decode(req.query.jwt, "secret");

			const tokenValid = hasValidJwt("secret", req, res, TokenType.normal)

			expect(res.status).toHaveBeenCalledTimes(0)
			expect(tokenValid).toBe(true)

		});


	});
});
