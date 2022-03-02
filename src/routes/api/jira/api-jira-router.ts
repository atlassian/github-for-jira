import { Router } from "express";
import { oneOf, param } from "express-validator";
import { returnOnValidationError } from "../api-utils";
import { ApiJiraGet } from "./api-jira-get";
import { ApiJiraUninstallPost } from "./api-jira-uninstall-post";
import { ApiJiraVerifyPost } from "./api-jira-verify-post";

export const ApiJiraRouter = Router();

ApiJiraRouter.post(
	"/:installationId/verify",
	param("installationId").isInt(),
	returnOnValidationError,
	ApiJiraVerifyPost
);

ApiJiraRouter.post(
	"/:clientKey/uninstall",
	param("clientKey").isHexadecimal(),
	returnOnValidationError,
	ApiJiraUninstallPost
);

ApiJiraRouter.get(
	"/:clientKeyOrJiraHost",
	[
		oneOf([
			param("clientKeyOrJiraHost").isURL(),
			param("clientKeyOrJiraHost").isHexadecimal()
		]),
		returnOnValidationError
	],
	ApiJiraGet
);
