import { Router } from "express";
import { GithubSetupGet } from "./github-setup-get";
import { GithubSetupPost } from "./github-setup-post";

export const GithubSetupRouter = Router();

GithubSetupRouter.route("/")
	.get(GithubSetupGet)
	.post(GithubSetupPost);

