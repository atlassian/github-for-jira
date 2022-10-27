import { Router } from "express";
import { GithubBranchGet } from "routes/github/branch/github-branch-get";

export const GithubBranchRouter = Router();

GithubBranchRouter.get("/owner/:owner/repo/:repo/:ref", GithubBranchGet);
