import { Router } from "express";
import { GithubConfigurationGet } from "./configuration/github-configuration-get";
import { GithubConfigurationPost } from "./configuration/github-configuration-post";
import { GithubSetupGet } from "./setup/github-setup-get";
import { GithubSetupPost } from "./setup/github-setup-post";
import { GithubSubscriptionGet } from "./subscription/github-subscription-get";
import { GithubSubscriptionDelete } from "./subscription/github-subscription-delete";
import { GithubAuthMiddleware, GithubOAuthRouter } from "./github-oauth-router";
import { csrfMiddleware } from "../../middleware/csrf-middleware";

export const GithubRouter = Router();

// OAuth Routes
GithubRouter.use(GithubOAuthRouter);

// CSRF Protection Middleware for all following routes
GithubRouter.use(csrfMiddleware);

GithubRouter.route("/setup")
	.get(GithubSetupGet)
	.post(GithubSetupPost);

// All following routes need Github Auth
GithubRouter.use(GithubAuthMiddleware);

GithubRouter.route("/configuration")
	.get(GithubConfigurationGet)
	.post(GithubConfigurationPost);

GithubRouter.route("/subscription")
	.get(GithubSubscriptionGet)
	.delete(GithubSubscriptionDelete);
