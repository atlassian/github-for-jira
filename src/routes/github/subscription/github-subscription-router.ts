import { Router } from "express";
import { GithubSubscriptionGet } from "./github-subscription-get";
import { GithubSubscriptionDelete } from "./github-subscription-delete";
import { param } from "express-validator";
import { returnOnValidationError } from "../../api/api-utils";

export const GithubSubscriptionRouter = Router();

GithubSubscriptionRouter.route("/:installationId")
	.all(param("installationId").isInt(), returnOnValidationError)
	.get(GithubSubscriptionGet)
	.delete(GithubSubscriptionDelete);

// TODO: remove legacy route
GithubSubscriptionRouter.post("/", GithubSubscriptionDelete);
