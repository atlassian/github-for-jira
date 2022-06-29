import { Router } from "express";
import { JiraVerifyServerUrlPost } from "../server/jira-verify-server-url-post";

export const JiraVerifyServerUrlRouter = Router();

JiraVerifyServerUrlRouter.route("/")
	.post(JiraVerifyServerUrlPost);
