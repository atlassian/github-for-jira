import { Router } from "express";
import { GithubConfigurationGet } from "./github-configuration-get";
import { GithubConfigurationPost } from "./github-configuration-post";

export const GithubConfigurationRouter = Router();

// add id
// no id = cloud
// add middleware - check that app exists and that it correlates with the jiraHost
GithubConfigurationRouter.route("/:id?")
	.all() // add middleware
	.get(GithubConfigurationGet)
	.post(GithubConfigurationPost);
