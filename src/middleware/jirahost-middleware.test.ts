import {NextFunction, Request, Response} from "express";
import {jirahostMiddleware} from "./jirahost-middleware";
import {verifyJiraJwtMiddleware } from "middleware/jira-jwt-middleware";
import {postInstallUrl} from "routes/jira/jira-atlassian-connect-get";

jest.mock("middleware/jira-jwt-middleware");
const mockVerifyJiraJwtMiddleware = (verifyJiraJwtMiddleware as any) as jest.Mock<typeof verifyJiraJwtMiddleware>;

//const APP_URL = 'https://github-for-jira-app.atlassian.com';
const LEGIT_JIRA_HOST = "https://legit-jira-host.atlassian.net";

describe("jirahostMiddleware", () => {

	let req: Request, res: Response, next: NextFunction;
	beforeEach(() => {
		req = getReq();
		res = getRes();
		next = jest.fn();
		mockVerifyJiraJwtMiddleware.mockImplementation(() => () => async (_, __, n) => {n()});
	});

	describe("jiraHost is provided by jira software", () => {
		beforeEach(() => {
			req.path = postInstallUrl;
			req.method = "GET",
			req.query = {xdm_e: LEGIT_JIRA_HOST}
		});
		it("should extract jiraHost correctly from xdm_e query", () => {
			jirahostMiddleware(req, res, next);
			expectJiraHostInResLocals();
		});
	});
	describe("jiraHost is provided by app form post", () => {
		beforeEach(()=>{
			req.path = postInstallUrl;
			req.method = "POST";
			req.body = {jiraHost: LEGIT_JIRA_HOST}
		});
		it("should extract jiraHost correctly from request body", ()=>{
			jirahostMiddleware(req, res, next);
			expectJiraHostInResLocals();
		});
	});

	function expectJiraHostInResLocals() {
		expect(res.locals.jiraHost).toBe(LEGIT_JIRA_HOST);
	}
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
