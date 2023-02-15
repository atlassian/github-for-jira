// setup route middlewares
import { NextFunction, Request, Response } from "express";
import { verifyJiraJwtMiddleware } from "middleware/jira-jwt-middleware";
import { TokenType } from "~/src/jira/util/jwt";
import { moduleUrls } from "routes/jira/atlassian-connect/jira-atlassian-connect-get";
import { matchRouteWithPattern } from "utils/match-route-with-pattern";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";

/**
 * Checks if the URL matches any of the URL patterns defined in `moduleUrls`
 */
const checkPathValidity = (url: string) => moduleUrls.some(moduleUrl => matchRouteWithPattern(moduleUrl, url));

const extractUnsafeJiraHost = (req: Request): string | undefined => {
	req.log.info({ req }, "TESTJOSHH - extractUnsafeJiraHost");
	if (checkPathValidity(req.path) && req.method == "GET") {
		req.log.info("TESTJOSHH - HERA A");
		// Only save xdm_e query when on the GET post install url (iframe url)
		if (req.query.xdm_e) {
			req.log.info("TESTJOSHH - HERA A1");
			return req.query.xdm_e as string;
		} else {
			req.log.info("TESTJOSHH - HERA A2");
			return getJiraHostFromJwtToken(req.query.jwt as string, req.log);
		}

	} else if (["POST", "DELETE", "PUT"].includes(req.method)) {
		req.log.info("TESTJOSHH - HERA B");
		return req.body?.jiraHost;
	} else if (req.cookies.jiraHost) {
		req.log.info("TESTJOSHH - HERA C");
		return req.cookies.jiraHost;
	} else if (req.query?.jwt) {
		req.log.info("TESTJOSHH - HERA D");
		return getJiraHostFromJwtToken(req.query.jwt as string, req.log);
	}
	return undefined;
};

const getJiraHostFromJwtToken = (encodedToken: string, logger) => {
	try {
		logger.info({ encodedToken }, "TESTJK - encodedToken");
		const decodedToken = JSON.parse(Buffer.from(encodedToken.split(".")[1], "base64").toString());
		const tenantUrl = decodedToken.context.tenant.url;
		// prepend the protocol if its not there.

		logger.info({ tenantUrl }, "TESTJK - tenantUrl");
		return tenantUrl.includes("https://") ? tenantUrl : `https://${tenantUrl}`;
	} catch (error) {
		logger.error("Error extracting jiraHost from JWT");
		return null;
	}
};

export const getUnvalidatedJiraHost = (req: Request): string | undefined =>
	req.session?.jiraHost || extractUnsafeJiraHost(req);

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

	if (await booleanFlag(BooleanFlags.NEW_JWT_VALIDATION)) {
		req.log.info("Skipping jirahostMiddleware...");
		return next();
	}
	req.log.info("Executing jirahostMiddleware...");

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
