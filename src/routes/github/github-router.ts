import { Router } from "express";
import { GithubAuthMiddleware, GithubOAuthRouter } from "./github-oauth-router";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { GithubSubscriptionRouter } from "./subscription/github-subscription-router";
import { GithubSetupRouter } from "routes/github/setup/github-setup-router";
import { GithubConfigurationRouter } from "routes/github/configuration/github-configuration-router";
import { returnOnValidationError } from "../api/api-utils";
import { header } from "express-validator";
import { WebhookReceiverPost } from "./webhook/webhook-receiver-post";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";

export const GithubRouter = Router();

const GithubAppProvidedRouter = Router({ mergeParams: true });
GithubRouter.use("/:appId?", GithubAppProvidedRouter);

//Have an cover all middleware to extract the optional gitHubAppId
GithubAppProvidedRouter.use(GithubServerAppMiddleware);

// OAuth Routes
GithubAppProvidedRouter.use(GithubOAuthRouter);

// Webhook Route
GithubAppProvidedRouter.post("/webhooks/:uuid",
	header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).exists(),
	returnOnValidationError,
	WebhookReceiverPost);

// CSRF Protection Middleware for all following routes
GithubAppProvidedRouter.use(csrfMiddleware);

GithubAppProvidedRouter.use("/setup", GithubSetupRouter);

// All following routes need Github Auth
GithubAppProvidedRouter.use(GithubAuthMiddleware);

GithubAppProvidedRouter.use("/configuration", GithubConfigurationRouter);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
GithubAppProvidedRouter.use("/subscriptions?", GithubSubscriptionRouter);

