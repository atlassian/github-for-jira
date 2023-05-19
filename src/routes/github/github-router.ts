import { Router , NextFunction, Request, Response } from "express";
import { GithubAuthMiddleware, GithubOAuthRouter } from "./github-oauth-router";
import { GitHubOAuthInitiateUrlGet, GithubOAuthTokenExchangeGet } from "./github-oauth-api-router";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { GithubSubscriptionRouter } from "./subscription/github-subscription-router";
import { GithubSetupRouter } from "routes/github/setup/github-setup-router";
import { GithubConfigurationRouter } from "routes/github/configuration/github-configuration-router";
import { returnOnValidationError } from "../api/api-utils";
import { header } from "express-validator";
import { WebhookReceiverPost } from "./webhook/webhook-receiver-post";
import { GithubManifestRouter } from "~/src/routes/github/manifest/github-manifest-router";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { UUID_REGEX } from "~/src/util/regex";
import { GithubCreateBranchRouter } from "routes/github/create-branch/github-create-branch-router";
import { GithubRepositoryRouter } from "routes/github/repository/github-repository-router";
import { GithubBranchRouter } from "routes/github/branch/github-branch-router";
import { jiraSymmetricJwtMiddleware } from "~/src/middleware/jira-symmetric-jwt-middleware";
import { Errors } from "config/errors";
import { GithubEncryptHeaderPost } from "routes/github/github-encrypt-header-post";
import { jiraAdminPermissionsMiddleware } from "middleware/jira-admin-permission-middleware";

//  DO NOT USE THIS MIDDLEWARE ELSE WHERE EXCEPT FOR CREATE BRANCH FLOW AS THIS HAS SECURITY HOLE
// TODO - Once JWT is passed from Jira for create branch this middleware is obsolete.
const JiraHostFromQueryParamMiddleware = async (req: Request, res: Response, next: NextFunction) => {
	const jiraHost = req.query?.jiraHost as string;
	const { jwt } = req.query;

	if (!jiraHost && !jwt) {
		req.log.warn(Errors.MISSING_JIRA_HOST);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return;
	}
	res.locals.jiraHost = jiraHost;
	next();
};

// TODO - remove function once rollout complete
// False flag wont parse the jwt query param so we need to allow current functionality to work while this happens
const maybeJiraSymmetricJwtMiddleware = (req: Request, res: Response, next: NextFunction) => {
	if (req.query.jwt && req.query.jwt !== "{jwt}") {
		return jiraSymmetricJwtMiddleware(req, res, next);
	}
	return next();
};

export const GithubRouter = Router();
const subRouter = Router({ mergeParams: true });
GithubRouter.use(`/:uuid(${UUID_REGEX})?`, subRouter);

// Webhook Route
subRouter.post("/webhooks",
	header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).exists(),
	returnOnValidationError,
	WebhookReceiverPost);

//new oauth
subRouter.get("/oauth-url", GithubServerAppMiddleware, GitHubOAuthInitiateUrlGet);
subRouter.post("/oauth-exchange-token", jiraSymmetricJwtMiddleware, jiraAdminPermissionsMiddleware, GithubServerAppMiddleware, GithubOAuthTokenExchangeGet);

// Create-branch is seperated above since it currently relies on query param to extract the jirahost
// Todo able to move under the jirasymmetric middleware once flag completed
subRouter.use("/create-branch", JiraHostFromQueryParamMiddleware, maybeJiraSymmetricJwtMiddleware, GithubServerAppMiddleware, csrfMiddleware, GithubCreateBranchRouter);

subRouter.use("/repository", JiraHostFromQueryParamMiddleware, GithubServerAppMiddleware, csrfMiddleware, GithubRepositoryRouter);

subRouter.use("/branch", JiraHostFromQueryParamMiddleware, GithubServerAppMiddleware, csrfMiddleware, GithubBranchRouter);

// OAuth Routes
subRouter.use(GithubOAuthRouter);

subRouter.use(jiraSymmetricJwtMiddleware);
subRouter.use(jiraAdminPermissionsMiddleware); // This must stay after jiraSymmetricJwtMiddleware
subRouter.use(GithubServerAppMiddleware);

subRouter.post("/encrypt/header", GithubEncryptHeaderPost);


// CSRF Protection Middleware for all following routes
subRouter.use(csrfMiddleware);

subRouter.use("/setup", GithubSetupRouter);

// App Manifest flow routes
subRouter.use("/manifest", GithubManifestRouter);

subRouter.use(GithubAuthMiddleware);

subRouter.use("/configuration", GithubConfigurationRouter);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
subRouter.use("/subscriptions?", GithubSubscriptionRouter);
