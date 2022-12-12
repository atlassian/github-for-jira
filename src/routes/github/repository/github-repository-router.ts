import { Router } from "express";
import { GitHubRepositoryGet } from "routes/github/repository/github-repository-get";

export const GithubRepositoryRouter = Router();

GithubRepositoryRouter.route("/")
	.get(GitHubRepositoryGet);
