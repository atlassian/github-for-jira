import { NextFunction, Request, Response, Router } from "express";
import * as Sentry from "@sentry/node";
import { isNodeProd } from "utils/is-node-env";
import { Errors, UIDisplayableError } from "config/errors";
import { envVars }  from "config/env";
import { statsd }  from "config/statsd";
import { metricError } from "config/metric-names";
import { v4 as uuidv4 } from "uuid";
import { getCloudOrServerFromGitHubAppId } from "utils/get-cloud-or-server";
import { createUrlWithQueryString } from "utils/create-url-with-query-string";

export const attachErrorHandler = (router: Router) => {

	// Error endpoints to test out different error pages and messages
	const ErrorMiddlewareGet = (req: Request, res: Response, next: NextFunction) => {
		res.locals.showError = true;
		const error = new Error(req.params.message);
		if (req.params.name) {
			error.name = req.params.name;
		}
		next(error);
	};
	router.get(["/error", "/error/:message", "/error/:message/:name"], ErrorMiddlewareGet);

	// Add Sentry Context Data
	const sentryMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
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
	};
	router.use(sentryMiddleware);

	// Sentry error middleware
	const sentryErrorHandler = Sentry.Handlers.errorHandler();
	router.use(sentryErrorHandler);

	// Error and Catch all route - Handle anything that's missing or has throw an error
	const catchAllMiddleware = (err: Error, req: Request, res: Response, next: NextFunction) => {
		const errorReference = uuidv4();

		req.log.error({ payload: req.body, errorReference, err, req, res }, "Error in frontend");

		if (!isNodeProd() && res.locals.showError) {
			next(err);
			return;
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
		errorCodes[Errors.MISSING_JIRA_HOST] = 400;
		errorCodes[Errors.MISSING_GITHUB_TOKEN] = 400;
		errorCodes[Errors.MISSING_GITHUB_APP_NAME] = 400;
		errorCodes[Errors.MISSING_ISSUE_KEY] = 400;

		const messages = {
			[Errors.MISSING_JIRA_HOST]: "Session information missing - please enable all cookies in your browser settings.",
			[Errors.IP_ALLOWLIST_MISCONFIGURED]: `The GitHub org you are trying to connect is currently blocking our requests. To configure the GitHub IP Allow List correctly, <a href="${envVars.GITHUB_REPO_URL}/blob/main/docs/ip-allowlist.md">please follow these instructions</a>.`,
			[Errors.MISSING_GITHUB_APP_NAME]: "There was a problem creating your GitHub App. Please make sure you filled the GitHub App name and try again."
		};

		const errorStatusCode = err instanceof UIDisplayableError ? err.httpStatus : (errorCodes[err.message] || 500);
		const message = err instanceof UIDisplayableError ? err.message : messages[err.message];
		const gitHubProduct = getCloudOrServerFromGitHubAppId(res.locals.gitHubAppId);
		const tags = { status: String(errorStatusCode), gitHubProduct };

		statsd.increment(metricError.githubErrorRendered, tags, {});

		res.status(errorStatusCode).render("error.hbs", {
			title: "GitHub + Jira integration",
			errorReference,
			message,
			ctaUrl: req.query.retryUrl ? createUrlWithQueryString(req, req.query.retryUrl as string) : null,
			nonce: res.locals.nonce,
			githubRepoUrl: envVars.GITHUB_REPO_URL
		});
	};
	router.use(catchAllMiddleware);

};
