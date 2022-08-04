import { Router } from "express";
import { param } from "express-validator";
import { returnOnValidationError } from "../api-utils";
import { ApiInstallationSyncstateGet } from "./api-installation-syncstate-get";
import { ApiInstallationSyncPost } from "./api-installation-sync-post";
import { ApiInstallationGet } from "./api-installation-get";

export const ApiInstallationRouter = Router({ mergeParams: true });

ApiInstallationRouter.post(
	"/sync",
	ApiInstallationSyncPost
);

ApiInstallationRouter.get(
	"/",
	ApiInstallationGet
);

ApiInstallationRouter.get(
	"/:jiraHost/syncstate",
	param("jiraHost").isString(),
	returnOnValidationError,
	ApiInstallationSyncstateGet
);
