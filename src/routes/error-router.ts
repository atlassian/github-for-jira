import { NextFunction, Request, Response, Router } from "express";
import * as Sentry from "@sentry/node";
import { isNodeProd } from "utils/is-node-env";
import { Errors } from "config/errors";
import { envVars }  from "config/env";
import { statsd }  from "config/statsd";
import { metricError } from "config/metric-names";
import { v4 as uuidv4 } from "uuid";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { createUrlWithQueryString } from "utils/create-url-with-query-string";

interface Cta {
	text: string;
	action: string;
}

export const ErrorRouter = Router();

// Error endpoints to test out different error pages and messages
ErrorRouter.get(["/error", "/error/:message", "/error/:message/:name"], (req: Request, res: Response, next: NextFunction) => {
	res.locals.showError = true;
	const error = new Error(req.params.message);
	if (req.params.name) {
		error.name = req.params.name;
	}
	next(error);
});

// Add Sentry Context Data
ErrorRouter.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	Sentry.withScope((scope: Sentry.Scope): void => {
		const jiraHost = res.locals.jiraHost;
		if (jiraHost) {
			scope.setTag("jiraHost", jiraHost);
		}

		if (req.body) {
			Sentry.setExtra("Body", req.body);
		}

		next(err);
	});
});

// Sentry error middleware
ErrorRouter.use(Sentry.Handlers.errorHandler());

// Error and Catch all route - Handle anything that's missing or has throw an error
ErrorRouter.use((err: Error, req: Request, res: Response, next: NextFunction) => {
	const errorReference = uuidv4();

	req.log.error({ payload: req.body, errorReference, err, req, res }, "Error in frontend");

	if (!isNodeProd() && !res.locals.showError) {
		return next(err);
	}

	// Check for IP Allowlist error from Github and set the message explicitly
	// to be shown to the user in the error page
	// TODO: this should probably be a util function
	if (err.name == "HttpError" && err.message?.includes("organization has an IP allow list enabled")) {
		err.message = Errors.IP_ALLOWLIST_MISCONFIGURED;
	}

	// TODO: move this somewhere else, enum?
	const errorCodes = {
		Unauthorized: 401,
		Forbidden: 403,
		"Not Found": 404
	};

	let message: string | null = null;
	let ctaUrl: Cta | null = null;
	switch (err.message) {
		case Errors.MISSING_JIRA_HOST:
			message = "Session information missing - please enable all cookies in your browser settings.";
			break;
		case Errors.MISSING_GITHUB_APP_NAME:
			message = "There was a problem creating your GitHub App. Please make sure you filled the GitHub App name and try again.";
			req.query.ghRedirect = "to";
			req.query.autoApp = "1";
			ctaUrl = {
				text: "Retry",
				action: createUrlWithQueryString(req, "/session")
			};
			break;
		case Errors.IP_ALLOWLIST_MISCONFIGURED:
			message = `The GitHub org you are trying to connect is currently blocking our requests. To configure the GitHub IP Allow List correctly, <a href="${envVars.GITHUB_REPO_URL}/blob/main/docs/ip-allowlist.md">please follow these instructions</a>.`;
			break;
		default:
			break;
	}

	const errorStatusCode = errorCodes[err.message] || 500;
	const gitHubProduct = getCloudOrServerFromGitHubAppId(res.locals.gitHubAppId);
	const tags = [`status: ${errorStatusCode}`, `gitHubProduct: ${gitHubProduct}`];

	statsd.increment(metricError.githubErrorRendered, tags);

	return res.status(errorStatusCode).render("error.hbs", {
		title: "GitHub + Jira integration",
		errorReference,
		message,
		ctaUrl,
		nonce: res.locals.nonce,
		githubRepoUrl: envVars.GITHUB_REPO_URL
	});
});
