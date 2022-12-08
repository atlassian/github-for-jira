import { Router } from "express";
import { GithubAuthMiddleware, GithubOAuthRouter } from "./github-oauth-router";
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
import { NextFunction, Request, Response } from "express";

// TODO - Once JWT is passed from Jira for create branch this midddleware is obsolete.
const JiraHostFromQueryParamMiddleware = async (req: Request, res: Response, next: NextFunction) => {
	const jiraHost = req.query?.jiraHost as string;
	if (!jiraHost) {
		req.log.warn(Errors.MISSING_JIRA_HOST);
		res.status(400).send(Errors.MISSING_JIRA_HOST);
		return;
	}
	res.locals.jiraHost = jiraHost;
	next();
};

export const GithubRouter = Router();
const subRouter = Router({ mergeParams: true });
GithubRouter.use(`/:uuid(${UUID_REGEX})?`, subRouter);

// Webhook Route
subRouter.post("/webhooks",
	header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).exists(),
	returnOnValidationError,
	WebhookReceiverPost);

//Have an cover all middleware to extract the optional gitHubAppId
//subRouter.use(param("uuid").isUUID('all'), GithubServerAppMiddleware);

// TODO: use jiraSymmetricJwtMiddleware and GithubServerAppMiddleware for all paths below once "create branch" supports JWT
// subRouter.use(jiraSymmetricJwtMiddleware);
// subRouter.use(GithubServerAppMiddleware);

// OAuth Routes
subRouter.use(GithubOAuthRouter);

// CSRF Protection Middleware for all following routes
subRouter.use(csrfMiddleware, GithubServerAppMiddleware);

subRouter.use("/setup", jiraSymmetricJwtMiddleware, GithubServerAppMiddleware, GithubSetupRouter);

// TODO: use GithubAuthMiddleware for all paths below once "create branch" supports JWT
// subRouter.use(GithubAuthMiddleware);

// App Manifest flow routes
subRouter.use("/manifest", jiraSymmetricJwtMiddleware, GithubServerAppMiddleware, GithubManifestRouter);

subRouter.use("/configuration", jiraSymmetricJwtMiddleware, GithubServerAppMiddleware, GithubAuthMiddleware, GithubConfigurationRouter);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
subRouter.use("/subscriptions?", jiraSymmetricJwtMiddleware, GithubServerAppMiddleware, GithubAuthMiddleware, GithubSubscriptionRouter);

subRouter.use("/create-branch", JiraHostFromQueryParamMiddleware, GithubServerAppMiddleware, GithubAuthMiddleware, GithubCreateBranchRouter);

subRouter.use("/repository", jiraSymmetricJwtMiddleware, GithubServerAppMiddleware, GithubAuthMiddleware, GithubRepositoryRouter);

subRouter.use("/branch", GithubServerAppMiddleware, GithubAuthMiddleware, GithubBranchRouter);
