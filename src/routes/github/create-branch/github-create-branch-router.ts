import { Router } from "express";
import { GithubCreateBranchGet } from "routes/github/create-branch/github-create-branch-get";
import { GithubCreateBranchPost } from "routes/github/create-branch/github-create-branch-post";
import { GithubBranchesGet } from "~/src/routes/github/create-branch/github-branches-get";
import { GithubRemoveSession } from "~/src/routes/github/create-branch/github-remove-session";

export const GithubCreateBranchRouter = Router();

GithubCreateBranchRouter.route("/")
	.get(GithubCreateBranchGet)
	.post(GithubCreateBranchPost);

GithubCreateBranchRouter.get("/owners/:owner/repos/:repo/branches", GithubBranchesGet);

GithubCreateBranchRouter.get("/change-github-login", GithubRemoveSession);
