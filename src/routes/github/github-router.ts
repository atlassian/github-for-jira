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

const GithubRouterWithUUID  = Router({mergeParams: true});
GithubRouter.use("/:gitHubServerAppUUID?", GithubRouterWithUUID);

GithubRouterWithUUID.use(GithubServerAppMiddleware);

// OAuth Routes
GithubRouterWithUUID.use(GithubOAuthRouter);

// Webhook Route
GithubRouterWithUUID.post("/webhooks/:uuid",
	header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).exists(),
	returnOnValidationError,
	WebhookReceiverPost);

// CSRF Protection Middleware for all following routes
GithubRouterWithUUID.use(csrfMiddleware);

GithubRouterWithUUID.use("/setup", GithubSetupRouter);

// All following routes need Github Auth
GithubRouterWithUUID.use(GithubAuthMiddleware);

GithubRouterWithUUID.use("/configuration", GithubConfigurationRouter);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
GithubRouterWithUUID.use("/subscriptions?", GithubSubscriptionRouter);
