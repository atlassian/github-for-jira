import { Router } from "express";
import { GithubAuthMiddleware, GithubOAuthRouter } from "./github-oauth-router";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { GithubSubscriptionRouter } from "./subscription/github-subscription-router";
import { GithubSetupRouter } from "routes/github/setup/github-setup-router";
import { GithubConfigurationRouter } from "routes/github/configuration/github-configuration-router";

export const GithubRouter = Router();

// OAuth Routes
GithubRouter.use(GithubOAuthRouter);

// CSRF Protection Middleware for all following routes
GithubRouter.use(csrfMiddleware);

GithubRouter.use("/setup", GithubSetupRouter);

// All following routes need Github Auth
GithubRouter.use(GithubAuthMiddleware);

GithubRouter.use("/configuration", GithubConfigurationRouter);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
GithubRouter.use("/subscriptions?", GithubSubscriptionRouter);
