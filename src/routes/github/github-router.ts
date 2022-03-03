import { Router } from "express";
import { GithubConfigurationGet } from "./configuration/github-configuration-get";
import { GithubConfigurationPost } from "./configuration/github-configuration-post";
import { GithubSetupGet } from "./setup/github-setup-get";
import { GithubSetupPost } from "./setup/github-setup-post";
import { GithubAuthMiddleware, GithubOAuthRouter } from "./github-oauth-router";
import { csrfMiddleware } from "../../middleware/csrf-middleware";
import { GithubSubscriptionRouter } from "./subscription/github-subscription-router";
import { body, query } from "express-validator";
import { returnOnValidationError } from "../api/api-utils";

export const GithubRouter = Router();

// OAuth Routes
GithubRouter.use(GithubOAuthRouter);

// CSRF Protection Middleware for all following routes
GithubRouter.use(csrfMiddleware);

GithubRouter.route("/setup")
	.get(query("installation_id").isInt(), returnOnValidationError, GithubSetupGet)
	.post(GithubSetupPost);

// All following routes need Github Auth
GithubRouter.use(GithubAuthMiddleware);

GithubRouter.route("/configuration")
	.get(GithubConfigurationGet)
	.post(body("installationId").isInt(), returnOnValidationError, GithubConfigurationPost);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
GithubRouter.use("/subscriptions?", GithubSubscriptionRouter);
