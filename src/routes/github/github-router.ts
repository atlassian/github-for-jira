import { Router } from "express";
import { GithubConfigurationGet } from "./configuration/github-configuration-get";
import { GithubConfigurationPost } from "./configuration/github-configuration-post";
import { GithubSetupGet } from "./setup/github-setup-get";
import { GithubSetupPost } from "./setup/github-setup-post";
import { GithubAuthMiddleware, GithubOAuthRouter } from "./github-oauth-router";
import { csrfMiddleware } from "../../middleware/csrf-middleware";
import { GithubSubscriptionRouter } from "./subscription/github-subscription-router";

export const GithubRouter = Router();

// OAuth Routes
GithubRouter.use(GithubOAuthRouter);

// CSRF Protection Middleware for all following routes
GithubRouter.use(csrfMiddleware);

GithubRouter.post("/setup", GithubSetupPost);

// All following routes need Github Auth
GithubRouter.use(GithubAuthMiddleware);

GithubRouter.get("/setup", GithubSetupGet)

GithubRouter.route("/configuration")
	.get(GithubConfigurationGet)
	.post(GithubConfigurationPost);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
GithubRouter.use("/subscriptions?", GithubSubscriptionRouter);
