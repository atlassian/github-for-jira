import { Router } from "express";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraRepositoriesGet } from "./jira-repositories-get";

export const JiraRepositoriesRouter = Router();


JiraRepositoriesRouter.route("/search")
	.get(csrfMiddleware, JiraRepositoriesGet);
// .get(csrfMiddleware, jiraSymmetricJwtMiddleware, JiraRepositoriesGet);
