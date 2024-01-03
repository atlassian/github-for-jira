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
	const encodedGHEBaseUrl = req.params.serverUrl;

	if (!encodedGHEBaseUrl){
		throw new InvalidArgumentError(
			"Invalid route, couldn't find encodedGHEBaseUrl in rest api req params!"
		);
	}
	const gitHubBaseUrl = decodeURIComponent(encodedGHEBaseUrl);

	await GitHubServerApp.uninstallServer(
		gitHubBaseUrl,
		installation.id
	);
	// TODO: manually delete subscriptions after GHE server is removed
	if (!(await isConnected(installation.jiraHost))) {
		await saveConfiguredAppProperties(installation.jiraHost, req.log, false);
	}
	res.sendStatus(204);
};

export const deleteEnterpriseServerHandler = errorWrapper(
	"deleteEnterpriseServerHandler",
	deleteEnterpriseServer
);
