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
const routerWithOptionalId = Router();
//TODO: ARC-1515 confirm the unique id and possibly change it to uuid
GithubRouter.use("/:githubAppId?", routerWithOptionalId);

//With optional uuid, veirfy for GitHub Server App and put config in locals
routerWithOptionalId.use(GithubServerAppMiddleware);

// OAuth Routes
routerWithOptionalId.use(GithubOAuthRouter);

// Webhook Route
routerWithOptionalId.post("/webhooks",
	header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).exists(),
	returnOnValidationError,
	WebhookReceiverPost);

// CSRF Protection Middleware for all following routes
routerWithOptionalId.use(csrfMiddleware);

routerWithOptionalId.use("/setup", GithubSetupRouter);

// All following routes need Github Auth
routerWithOptionalId.use(GithubAuthMiddleware);

routerWithOptionalId.use("/configuration", GithubConfigurationRouter);

// TODO: remove optional "s" once we change the frontend to use the proper delete method
routerWithOptionalId.use("/subscriptions?", GithubSubscriptionRouter);
