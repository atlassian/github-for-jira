import { Router } from "express";
import { GithubSetupGet } from "./github-setup-get";
import { GithubSetupPost } from "./github-setup-post";
import { query } from "express-validator";
import { returnOnValidationError } from "routes/api/api-utils";

export const GithubSetupRouter = Router();

GithubSetupRouter.route("/")
	.get(query("installation_id").isInt(), returnOnValidationError, GithubSetupGet)
	.post(GithubSetupPost);

