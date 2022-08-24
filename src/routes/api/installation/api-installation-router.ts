import { Router } from "express";
import { param } from "express-validator";
import { returnOnValidationError } from "../api-utils";
import { ApiInstallationDelete } from "./api-installation-delete";
import { ApiInstallationSyncstateGet } from "./api-installation-syncstate-get";
import { ApiInstallationSyncPost } from "./api-installation-sync-post";
import { ApiInstallationGet } from "./api-installation-get";

export const ApiInstallationRouter = Router({ mergeParams: true });
const subRouter = Router({ mergeParams: true });
ApiInstallationRouter.use(`(/githubapp/:gitHubAppId(\\d+))?`, subRouter);

subRouter.post(
	"/sync",
	ApiInstallationSyncPost
);

subRouter.get(
	"/",
	ApiInstallationGet
);

subRouter.get(
	"/:jiraHost/syncstate",
	param("jiraHost").isString(),
	returnOnValidationError,
	ApiInstallationSyncstateGet
);

subRouter.delete(
	"/:jiraHost",
	param("jiraHost").isString(),
	returnOnValidationError,
	ApiInstallationDelete
);
