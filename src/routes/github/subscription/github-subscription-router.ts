import { Router } from "express";
import { GithubSubscriptionDelete } from "./github-subscription-delete";
import { param } from "express-validator";
import { returnOnValidationError } from "../../api/api-utils";

export const GithubSubscriptionRouter = Router();

GithubSubscriptionRouter.route("/:installationId")
	.all(param("installationId").isInt(), returnOnValidationError)
	.delete(GithubSubscriptionDelete);
