import {NextFunction, Request, Response} from "express";
import {jirahostMiddleware} from "./jirahost-middleware";
import {verifyJiraJwtMiddleware } from "middleware/jira-jwt-middleware";
import {postInstallUrl} from "routes/jira/jira-atlassian-connect-get";
import {TokenType} from "~/src/jira/util/jwt";

jest.mock("middleware/jira-jwt-middleware");
const mockVerifyJiraJwtMiddleware = (verifyJiraJwtMiddleware as any) as jest.Mock<typeof verifyJiraJwtMiddleware>;

//const APP_URL = 'https://github-for-jira-app.atlassian.com';
const LEGIT_JIRA_HOST = "https://legit-jira-host.atlassian.net";
const TEST_JWT_TOKEN = 'TO_BE_DETERMINED';

describe("jirahostMiddleware", () => {

	let req: Request, res: Response, next: NextFunction;
	let mockJwtVerificationFn: jest.Mock;

	beforeEach(() => {
		req = getReq();
		res = getRes();
		next = jest.fn();
		mockJwtVerificationFn = jest.fn();
		mockVerifyJiraJwtMiddleware.mockReturnValue(mockJwtVerificationFn);
	});

	describe('jiraHost is provided in a trusted session cookie', ()=>{

		it('should extract jiraHost from session', ()=>{

			req.session.jiraHost = LEGIT_JIRA_HOST;

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(next).toBeCalled();
		});

	});

	describe("jiraHost is provided by jira", () => {

		it("should extract jiraHost correctly from xdm_e query", () => {

			req.path = postInstallUrl;
			req.method = "GET",
			req.query = {xdm_e: LEGIT_JIRA_HOST}

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(mockVerifyJiraJwtMiddleware).toBeCalledWith(TokenType.normal);
		});

	});

	describe("jiraHost is provided by app form post", () => {

		it("should extract jiraHost correctly from request body", ()=>{

			req.path = postInstallUrl;
			req.method = "POST";
			req.body = {jiraHost: LEGIT_JIRA_HOST}

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(mockVerifyJiraJwtMiddleware).toBeCalledWith(TokenType.context);
		});

	});

	describe('jiraHost is provided by cookie as temporary method', () => {

		it("should extract jiraHost correctly from cookie and remove cookie", () => {

			req.path = '/whatever';
			req.method = 'GET';
			req.cookies.jiraHost = LEGIT_JIRA_HOST;
			req.cookies.jwt = TEST_JWT_TOKEN;

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(res.clearCookie).toBeCalledWith('jiraHost');

			const calledReq = mockJwtVerificationFn.mock.calls[0][0];
			const calledRes = mockJwtVerificationFn.mock.calls[0][1];
			expect(calledRes.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(calledReq.cookies.jwt).toBe(TEST_JWT_TOKEN);
			expect(mockVerifyJiraJwtMiddleware).toBeCalledWith(TokenType.context);
			expect(mockJwtVerificationFn).toBeCalled();

			//TODO
			expect(res.clearCookie).toBeCalledWith('jwt');
			expect(req.session.jiraHost).toBe(LEGIT_JIRA_HOST);

		});

	});

});

function getReq(): Request {
	return ({
		path: "/",
		query: {},
		body: {},
		addLogFields: jest.fn(),
		session: {},
		cookies: {}
	} as any) as Request;
}

function getRes(): Response {
	return ({
		locals: {},
		clearCookie: jest.fn()
	} as any) as Response;
}
