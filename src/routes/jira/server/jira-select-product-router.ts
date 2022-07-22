import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { JiraSelectProductGet } from "./jira-select-product-get";
import { csrfMiddleware } from "middleware/csrf-middleware";

export const JiraSelectProductRouter = Router();

JiraSelectProductRouter.route("/")
	.get(csrfMiddleware, JiraJwtTokenMiddleware, JiraSelectProductGet);
