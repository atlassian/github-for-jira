import { Router } from "express";
import { GithubCreateBranchGet } from "routes/github/create-branch/github-create-branch-get";

export const GithubCreateBranchRouter = Router();

GithubCreateBranchRouter.route("/")
	.get(GithubCreateBranchGet);

