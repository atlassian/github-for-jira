// setup route middlewares
import { NextFunction, Request, Response } from "express";
import { verifyJiraJwtMiddleware } from "middleware/jira-jwt-middleware";
import { TokenType } from "~/src/jira/util/jwt";
import { moduleUrls, postInstallUrl } from "routes/jira/jira-atlassian-connect-get";

const REQUEST_PATHS = ["/jira/sync", "/jira/server-url"];

const extractUnsafeJiraHost = (req: Request): string | null => {
	const currentPath = REQUEST_PATHS.filter(path => path === req.path);

	if (moduleUrls.includes(req.path) && req.method == "GET") {
		// Only save xdm_e query when on the GET post install url (iframe url)
		return req.query.xdm_e as string;
	} else if ((req.path == postInstallUrl && req.method != "GET") || req.path == currentPath[0]) {
		return req.body?.jiraHost;
	} else if (req.cookies.jiraHost) {
		return req.cookies.jiraHost;
	}
	return null;
};

const detectJwtTokenType = (req: Request): TokenType => {
	if (req.query.xdm_e) {
		return TokenType.normal;
	}
	return TokenType.context;
};

//
// Updates res.locals.jiraHost based on values in the request if JWT validation is OK.
//
// Q: Could I provide a fake jiraHost but a valid JWT, would it impersonate me as someone else?
// A: No. Each Jira has its own connect shared secret. When a fake jiraHost is provided, a wrong shared secret is
//    fetched and JWT validation will fail.
//
//
export const jirahostMiddleware = async (req: Request, res: Response, next: NextFunction) => {

	const unsafeJiraHost = extractUnsafeJiraHost(req);

	req.addLogFields({ jiraHost: unsafeJiraHost });

	// JWT validation makes sure "res.locals.jiraHost" is legit, not the cookie value. To avoid
	// any temptation to use it later, let's remove it straight away!
	const takenFromCookies = unsafeJiraHost === req.cookies.jiraHost;
	res.clearCookie("jiraHost");

	if (unsafeJiraHost) {
		// Even though it is unsafe, we are verifying it straight away below (in "verifyJwtBlahBlah" call)
		res.locals.jiraHost = unsafeJiraHost;
		await verifyJiraJwtMiddleware(detectJwtTokenType(req))(req, res, () => {

			// Cannot hold and rely on cookies because the issued context JWTs are short-lived
			// (enough to validate once but not enough for long-running routines)
			if (takenFromCookies) {
				req.session.jiraHost = res.locals.jiraHost;
			}
			// Cleaning up outside of "if" to unblock cookies if they were corrupted somehow
			// on any other successful validation (e.g. when /jira/configuration is refreshed)
			res.clearCookie("jwt");

			next();
		});
	} else {
		res.locals.jiraHost = req.session.jiraHost;
		next();
	}
};
