import { Router } from "express";
import { GithubCreateBranchGet } from "routes/github/create-branch/github-create-branch-get";
import { GithubCreateBranchPost } from "routes/github/create-branch/github-create-branch-post";

export const GithubCreateBranchRouter = Router();

GithubCreateBranchRouter.route("/")
	.get(GithubCreateBranchGet)
	.post(GithubCreateBranchPost);
