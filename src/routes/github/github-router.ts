import { Router } from "express";
import {
	GithubAuthMiddleware,
	GithubOAuthCallbackGet, GithubOAuthLoginGet,
	OAUTH_CALLBACK_SUBPATH
} from "./github-oauth";
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
import { GithubEncryptHeaderPost } from "routes/github/github-encrypt-header-post";
import { jiraAdminPermissionsMiddleware } from "middleware/jira-admin-permission-middleware";

export const GithubRouter = Router();
const subRouter = Router({ mergeParams: true });


// We want to restrict the tail of OAuth flow to the same scope as the starting point had (where GitHubOAuthMiddleware
// fired), therefore we are not including neither jira*middlewares nor github*middlewares. GithubOAuthCallbackGet will
// get all the data needed from session to obtain the token and then redirect to the original URL with all the
// restrictions that are in place there.
// We don't want to artificially limit ourselves by including those middlewares, because there are scenarios when
// OAuth flow was triggered outside of Jira admin scope (e.g. create-branch, or approve-connection).
subRouter.use(OAUTH_CALLBACK_SUBPATH, GithubOAuthCallbackGet);

GithubRouter.use(`/:uuid(${UUID_REGEX})?`, subRouter);

// Webhook Route
subRouter.post("/webhooks",
	header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).exists(),
	returnOnValidationError,
	WebhookReceiverPost);

subRouter.use(jiraSymmetricJwtMiddleware);
subRouter.use(GithubServerAppMiddleware);

subRouter.use("/create-branch", csrfMiddleware, GithubCreateBranchRouter);
subRouter.use("/repository", csrfMiddleware, GithubRepositoryRouter);
subRouter.use("/branch", csrfMiddleware, GithubBranchRouter);

subRouter.use(jiraAdminPermissionsMiddleware); // This must stay after jiraSymmetricJwtMiddleware

subRouter.use("/login",  GithubOAuthLoginGet);

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
