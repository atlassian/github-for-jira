import { Router } from "express";
import { JiraJwtTokenMiddleware } from "middleware/jira-jwt-middleware";
import { csrfMiddleware } from "middleware/csrf-middleware";
import { JiraConnectEnterpriseGet } from "./jira-connect-enterprise-get";

export const JiraConnectEnterpriseRouter = Router();


JiraConnectEnterpriseRouter.route("/").get(csrfMiddleware, JiraJwtTokenMiddleware, JiraConnectEnterpriseGet);