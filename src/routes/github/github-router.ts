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

const UUID_REGEX = "[0-9a-fA-F]{8}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{4}\\b-[0-9a-fA-F]{12}";

export const GithubRouter = Router({mergeParams: true});
const subRouter = Router({mergeParams: true});
GithubRouter.use(`/:uuid(${UUID_REGEX})?`, subRouter);

//Have an cover all middleware to extract the optional gitHubAppId
//subRouter.use(param("uuid").isUUID('all'), GithubServerAppMiddleware);
subRouter.use(GithubServerAppMiddleware);

// OAuth Routes
subRouter.use(GithubOAuthRouter);

// Webhook Route
subRouter.post("/webhooks",
	header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).exists(),
	returnOnValidationError,
	WebhookReceiverPost);

// CSRF Protection Middleware for all following routes
subRouter.use(csrfMiddleware);

subRouter.use("/setup", GithubSetupRouter);

// All following routes need Github Auth
subRouter.use(GithubAuthMiddleware);

subRouter.use("/configuration", GithubConfigurationRouter);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
subRouter.use("/subscriptions?", GithubSubscriptionRouter);

