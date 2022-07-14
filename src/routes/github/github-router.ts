import { Router } from "express";
import { GithubServerAppMiddleware } from "middleware/github-server-app-middleware";
import { GithubAuthMiddleware, GithubOAuthRouter } from "./github-oauth-router";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { GithubSubscriptionRouter } from "./subscription/github-subscription-router";
import { GithubSetupRouter } from "routes/github/setup/github-setup-router";
import { GithubConfigurationRouter } from "routes/github/configuration/github-configuration-router";
import { returnOnValidationError } from "../api/api-utils";
import { header } from "express-validator";
import { WebhookReceiverPost } from "./webhook/webhook-receiver-post";

export const GithubRouter = Router();

//attach GitHub Server App optional uuid
const routerWithOptionalGHAppUUID = Router();
GithubRouter.use("/:uuid?", routerWithOptionalGHAppUUID);

//With optional uuid, veirfy for GitHub Server App and put config in locals
routerWithOptionalGHAppUUID.use(GithubServerAppMiddleware);

// OAuth Routes
routerWithOptionalGHAppUUID.use(GithubOAuthRouter);

// Webhook Route
routerWithOptionalGHAppUUID.post("/webhooks/:uuid",
	header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).exists(),
	returnOnValidationError,
	WebhookReceiverPost);

// CSRF Protection Middleware for all following routes
routerWithOptionalGHAppUUID.use(csrfMiddleware);

routerWithOptionalGHAppUUID.use("/setup", GithubSetupRouter);

// All following routes need Github Auth
routerWithOptionalGHAppUUID.use(GithubAuthMiddleware);

routerWithOptionalGHAppUUID.use("/configuration", GithubConfigurationRouter);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
routerWithOptionalGHAppUUID.use("/subscriptions?", GithubSubscriptionRouter);
