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

const attachRouterToRoute = (router: Router) => {

	router.use(GithubServerAppMiddleware);

	// OAuth Routes
	router.use(GithubOAuthRouter);

	// Webhook Route
	router.post("/webhooks/:uuid",
		header(["x-github-event", "x-hub-signature-256", "x-github-delivery"]).exists(),
		returnOnValidationError,
		WebhookReceiverPost);

	// CSRF Protection Middleware for all following routes
	router.use(csrfMiddleware);

	router.use("/setup", GithubSetupRouter);

	// All following routes need Github Auth
	router.use(GithubAuthMiddleware);

	router.use("/configuration", GithubConfigurationRouter);

	// TODO: remove optional "s" once we change the frontend to use the proper delete method
	router.use("/subscriptions?", GithubSubscriptionRouter);
}

attachRouterToRoute(GithubRouterWithUUID);
attachRouterToRoute(GithubRouter);

GithubRouter.use("/:gitHubAppId", GithubRouterWithUUID);
