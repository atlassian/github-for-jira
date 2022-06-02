import {NextFunction, Request, Response} from "express";
import {jirahostMiddleware} from "./jirahost-middleware";
import {verifyJiraJwtMiddleware } from "middleware/jira-jwt-middleware";
import {postInstallUrl} from "routes/jira/jira-atlassian-connect-get";
import {TokenType} from "~/src/jira/util/jwt";

jest.mock("middleware/jira-jwt-middleware");
const mockVerifyJiraJwtMiddleware = (verifyJiraJwtMiddleware as any) as jest.Mock<typeof verifyJiraJwtMiddleware>;

const LEGIT_JIRA_HOST = "https://legit-jira-host.atlassian.net";
const TEST_JWT_TOKEN = "TO_BE_DETERMINED";

describe("jirahostMiddleware", () => {

	let req: Request, res: Response, next: NextFunction;
	let mockJwtVerificationFn: jest.Mock;

	beforeEach(() => {
		req = getReq();
		res = getRes();
		next = jest.fn();
		mockJwtVerificationFn = jest.fn().mockImplementation((_, __, n) => n());
		mockVerifyJiraJwtMiddleware.mockReturnValue(mockJwtVerificationFn);
	});

	describe("jiraHost is provided in session", ()=>{

		it("should extract jiraHost from session when provided", ()=>{

			req.session.jiraHost = LEGIT_JIRA_HOST;

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(next).toBeCalled();
		});

		it("cookie should have priority", () => {

			req.cookies.jiraHost = LEGIT_JIRA_HOST;
			req.session.jiraHost = LEGIT_JIRA_HOST + "boo";

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(next).toBeCalled();
		});

		it("xdm_e should have priority", () => {

			configureLegitJiraReq(req);
			req.session.jiraHost = LEGIT_JIRA_HOST + "boo";

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(next).toBeCalled();
		});

		it("payload should have priority", () => {

			configureLegitFrontendReq(req);
			req.session.jiraHost = LEGIT_JIRA_HOST + "boo";

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(next).toBeCalled();
		});

	});

	describe("jiraHost is provided by Jira", () => {

		beforeEach(() => {
			configureLegitJiraReq(req);
		});

		it("should extract jiraHost correctly from xdm_e query and call next()", () => {

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(mockVerifyJiraJwtMiddleware).toBeCalledWith(TokenType.normal);
			expect(next).toBeCalled();
		});

		it("should not call next() when invalid", () => {

			mockJwtVerificationFn.mockImplementation(() => {
				//dothing
			});

			jirahostMiddleware(req, res, next);

			expect(next).not.toBeCalled();
		});

		it("should not be validated and used with wrong URL", () => {

			req.path = "/blah";

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBeUndefined();
			expect(mockJwtVerificationFn).not.toBeCalled();
			expect(next).toBeCalled();
		});

	});

	describe("jiraHost is provided by frontend in payload", () => {

		beforeEach(() => {
			configureLegitFrontendReq(req);
		});

		it("should extract jiraHost correctly from request body", ()=>{

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(mockVerifyJiraJwtMiddleware).toBeCalledWith(TokenType.context);
			expect(next).toBeCalled();
		});

		it("should not call next() when not valid", ()=>{

			mockJwtVerificationFn.mockImplementation(() => {
				//donothing
			});

			jirahostMiddleware(req, res, next);

			expect(next).not.toBeCalled();
		});

		it("should not be validated and used when wrong URL", ()=>{

			req.path = "/blah";

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBeUndefined();
			expect(mockJwtVerificationFn).not.toBeCalled();
			expect(next).toBeCalled();
		});

	});

	describe("jiraHost is provided by cookie as temporary method", () => {

		beforeEach(() => {
			req.path = "/whatever";
			req.method = "GET";
			req.cookies.jiraHost = LEGIT_JIRA_HOST;
			req.cookies.jwt = TEST_JWT_TOKEN;
		});

		it("should extract jiraHost correctly from cookie, validate it and save to session", () => {

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(mockVerifyJiraJwtMiddleware).toBeCalledWith(TokenType.context);
			expect(req.session.jiraHost).toBe(LEGIT_JIRA_HOST);
			expect(next).toBeCalled();
		});

		it ("should be deleted from the cookies together with JWT token",  () => {

			jirahostMiddleware(req, res, next);

			expect(res.clearCookie).toBeCalledWith("jiraHost");
			expect(res.clearCookie).toBeCalledWith("jwt");
		});

		it ("should not be saved in session and call next() when not valid",  () => {

			mockJwtVerificationFn.mockImplementation(() => {
				//donothing
			});

			jirahostMiddleware(req, res, next);

			expect(req.session.jiraHost).toBeUndefined();
			expect(next).not.toBeCalled();
		});

		it("xdm_e should have priority", () => {

			configureLegitJiraReq(req);
			req.cookies.jiraHost = LEGIT_JIRA_HOST + "boo";

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
		});

		it("xdm_e should be ignored and cookie is used when wrong URL", () => {

			configureLegitJiraReq(req);
			req.path = "/whatever";
			req.cookies.jiraHost = LEGIT_JIRA_HOST + "boo";

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST + "boo");
		});

		it("POST payload should have priority", () => {

			configureLegitFrontendReq(req);
			req.cookies.jiraHost = LEGIT_JIRA_HOST + "boo";

			jirahostMiddleware(req, res, next);

			expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
		});

		it ("should be deleted from the cookies together with JWT token even when not used",  () => {

			configureLegitFrontendReq(req);

			jirahostMiddleware(req, res, next);

			expect(res.clearCookie).toBeCalledWith("jiraHost");
			expect(res.clearCookie).toBeCalledWith("jwt");
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

function configureLegitJiraReq(req: Request) {
	req.path = postInstallUrl;
	req.method = "GET",
	req.query = { xdm_e: LEGIT_JIRA_HOST }
	req.body = {};
}

function configureLegitFrontendReq(req: Request) {
	req.path = postInstallUrl;
	req.method = "POST";
	req.query = {};
	req.body = {jiraHost: LEGIT_JIRA_HOST}
}
