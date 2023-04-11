import { Router } from "express";
import { GithubConfigurationGet } from "./github-configuration-get";
import { GithubConfigurationPost } from "./github-configuration-post";
import { GithubConfigurationAppInstallsGet } from "routes/github/configuration/github-configuration-app-installs-get";

export const GithubConfigurationRouter = Router();
GithubConfigurationRouter.route("/")
	.get(GithubConfigurationGet)
	.post(GithubConfigurationPost);

GithubConfigurationRouter.route("/app-installations")
	.get(GithubConfigurationAppInstallsGet);
