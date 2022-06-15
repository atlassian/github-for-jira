import { Router } from "express";
import { GithubConfigurationGet } from "./github-configuration-get";
import { GithubConfigurationPost } from "./github-configuration-post";
import { GithubConfigurationGitHubAppId } from "./github-configuration-gitHubAppId";

export const GithubConfigurationRouter = Router();


GithubConfigurationRouter.route("/:id?")
	.all(GithubConfigurationGitHubAppId) // add middleware
	.get(GithubConfigurationGet)
	.post(GithubConfigurationPost);
