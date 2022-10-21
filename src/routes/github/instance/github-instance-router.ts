import { Router } from "express";
import { GithubInstanceGet } from "./github-instance-get";

export const GithubInstanceRouter = Router();

GithubInstanceRouter.route("/")
	.get(GithubInstanceGet);
