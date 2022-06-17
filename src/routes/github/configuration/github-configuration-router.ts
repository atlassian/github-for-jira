import { Router } from "express";
import { GithubConfigurationGet } from "./github-configuration-get";
import { GithubConfigurationPost } from "./github-configuration-post";
import { githubServerAppMiddleware } from "middleware/github-server-app-middleware";

export const GithubConfigurationRouter = Router();

GithubConfigurationRouter.route("/:id?")
	.all(githubServerAppMiddleware)
	.get(GithubConfigurationGet)
	.post(GithubConfigurationPost);
