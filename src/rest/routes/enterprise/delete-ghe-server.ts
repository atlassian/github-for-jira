import { Request, Response } from "express";
import { ParamsDictionary } from "express-serve-static-core";
import { errorWrapper } from "../../helper";
import { BaseLocals } from "..";
import { GitHubServerApp } from "~/src/models/github-server-app";
import { isConnected } from "~/src/util/is-connected";
import { saveConfiguredAppProperties } from "~/src/util/app-properties-utils";
import { InvalidArgumentError } from "~/src/config/errors";

const deleteEnterpriseServer = async (
	req: Request<ParamsDictionary, unknown>,
	res: Response<string, BaseLocals>
): Promise<void> => {
	const { installation } = res.locals;

	const cloudOrUUID = req.params.cloudOrUUID;
	if (!cloudOrUUID) {
		throw new InvalidArgumentError(
			"Invalid route, couldn't determine UUID of enterprise server!"
		);
	}

	// TODO: Check and add test cases for GHE later
	const gitHubApp = await GitHubServerApp.getForUuidAndInstallationId(
		cloudOrUUID,
		installation.id
	);
	const gitHubBaseUrl = gitHubApp?.gitHubBaseUrl;
	if (!gitHubBaseUrl) {
		throw new InvalidArgumentError(
			"Invalid route, couldn't determine gitHubBaseUrl for enterprise server!"
		);
	}

	await GitHubServerApp.uninstallServer(
		gitHubBaseUrl,
		installation.id
	);

	if (!(await isConnected(installation.jiraHost))) {
		await saveConfiguredAppProperties(jiraHost, req.log, false);
	}
	res.status(200).json("Success");
};

export const deleteEnterpriseServerHandler = errorWrapper(
	"deleteEnterpriseServerHandler",
	deleteEnterpriseServer
);
