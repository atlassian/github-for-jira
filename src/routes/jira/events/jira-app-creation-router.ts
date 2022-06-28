import { Router } from "express";
// import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraAppCreationPost } from "../server/jira-app-creation-post";
// import { csrfMiddleware } from "middleware/csrf-middleware";

export const JiraAppCreationRouter = Router();

JiraAppCreationRouter.route("/")
	.post(JiraAppCreationPost);
