import express, { Express, NextFunction, Request, Response, RequestHandler } from "express";
import path from "path";
import { registerHandlebarsPartials } from "utils/handlebars/handlebar-partials";
import { registerHandlebarsHelpers } from "utils/handlebars/handlebar-helpers";
import crypto from "crypto";
import { elapsedTimeMetrics } from "config/statsd";
import sslify from "express-sslify";
import helmet from "helmet";
import { RootRouter } from "routes/router";
import { getLogger } from "config/logger";

export const setupFrontendApp = (app: Express): Express => {

	// We run behind ngrok.io so we need to trust the proxy always
	// TODO: look into the security of this.  Maybe should only be done for local dev?
	app.set("trust proxy", true);
	app.set("case sensitive routing", false);
	app.set("view engine", "hbs");
	const viewPath = path.resolve(process.cwd(), "views");
	app.set("views", viewPath);
	registerHandlebarsPartials(path.resolve(viewPath, "partials"));
	registerHandlebarsHelpers();
	// Add all routes
	app.use(RootRouter);

	return app;
};

const secureHeaders = (app: Express) => {
	app.use((_: Request, res: Response, next: NextFunction): void => {
		res.locals.nonce = crypto.randomBytes(16).toString("hex");
		next();
	});

	// Content Security Policy
	app.use(helmet.contentSecurityPolicy({
		useDefaults: true,
		directives: {
			defaultSrc: ["'self'"],
			// Allow <script> tags hosted by ourselves and from atlassian when inserted into an iframe
			scriptSrc: ["'self'", process.env.APP_URL, "https://*.atlassian.net", "https://*.jira.com", "https://connect-cdn.atl-paas.net/",
				"'unsafe-inline'", "'strict-dynamic'", (_: Request, res: Response): string => `'nonce-${res.locals.nonce}'`],
			// Allow XMLHttpRequest/fetch requests
			connectSrc: ["'self'", process.env.APP_URL],
			// Allow <style> tags hosted by ourselves as well as style="" attributes
			styleSrc: ["'self'", "'unsafe-inline'"],
			// Allow using github-for-jira pages as iframes only in jira
			frameAncestors: ["https://*.atlassian.net", "https://*.jira-dev.com", "https://*.jira.com"],
			//Doesn't allow usage of <base> element
			baseUri: ["'none'"],
			//Send SCP reports to Atlassian security monitoring
			reportUri: "https://web-security-reports.services.atlassian.com/csp-report/github-for-jira",
			// Allow self-hosted images, data: images, organization images and the error image
			imgSrc: ["'self'", "data:", "https://*.githubusercontent.com", "https://octodex.github.com"]
		}
	}));
	// Enable HSTS with the value we use for education.github.com
	app.use(helmet.hsts({
		maxAge: 15552000
	}));
	// X-Frame / Clickjacking protection
	// Disabling this. Will probably need to dynamically
	// set this based on the referrer URL and match if it's *.atlassian.net or *.jira.com
	// app.use(helmet.frameguard({ action: 'deny' }))
	// MIME-Handling: Force Save in IE
	app.use(helmet.ieNoOpen());
	// Disable caching
	app.use(helmet.noCache());
	// Disable mimetype sniffing
	app.use(helmet.noSniff());
	// Basic XSS Protection
	app.use(helmet.xssFilter());

	// Remove the X-Powered-By
	// This particular combination of methods works
	app.disable("x-powered-by");
	app.use(helmet.hidePoweredBy());
};

const logRequest = function ({logger}: any): RequestHandler {
	//Copy from origin probot logging config
	//https://github.com/probot/probot/blob/v9.15.1/src/middleware/logging.ts
	//However I remove all the trace/time logging, don't think we need those.
  return function (req: Request, res: Response, next: NextFunction) {
    // Make a logger available on the request
    req.log = logger;
    next()
  }
}

export const createFrontendApp = (): Express => {

	const app: Express = express();

	app.locals.log = getLogger("frontend");
	app.use(logRequest({logger: app.locals.logger}));

	app.use(elapsedTimeMetrics);

	if (process.env.FORCE_HTTPS) {
		app.use(sslify.HTTPS({ trustProtoHeader: true }));
	}

	setupFrontendApp(app);
	secureHeaders(app);

	return app;
};
