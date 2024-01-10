import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { errorWrapper } from "../../helper";
import { BaseLocals } from "..";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { isConnected } from "~/src/util/is-connected";
import { saveConfiguredAppProperties } from "~/src/util/app-properties-utils";
import { InvalidArgumentError } from "~/src/config/errors";

const deleteEnterpriseApp = async (
	req: Request<ParamsDictionary, unknown>,
	res: Response<string, BaseLocals>
): Promise<void> => {
	req.log.debug("Received Jira Connect Enterprise App DELETE request");
	const { installation } = res.locals;

	const cloudOrUUID = req.params.cloudOrUUID;
	const gheUUID = cloudOrUUID === "cloud" ? undefined : cloudOrUUID; //TODO: validate the uuid regex

	if (!gheUUID) {
		throw new InvalidArgumentError(
			"Invalid route, couldn't determine UUID of enterprise server!"
		);
	}

	await GitHubServerApp.uninstallApp(gheUUID);
	// TODO: manually delete subscriptions after GHE app is removed
	if (!(await isConnected(installation.jiraHost))) {
		await saveConfiguredAppProperties(installation.jiraHost, req.log, false);
	}
	res.sendStatus(204);
	req.log.debug("Jira Connect Enterprise App deleted successfully.");
};

export const deleteEnterpriseAppHandler = errorWrapper(
	"deleteEnterpriseAppHandler",
	deleteEnterpriseApp
);
