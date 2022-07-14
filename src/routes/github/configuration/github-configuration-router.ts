import { Router } from "express";
import { GithubConfigurationGet } from "./github-configuration-get";
import { GithubConfigurationPost } from "./github-configuration-post";

export const GithubConfigurationRouter = Router();
GithubConfigurationRouter.route("/")
	.get(GithubConfigurationGet)
	.post(GithubConfigurationPost);
