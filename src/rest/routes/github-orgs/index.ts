import { Router, Request, Response } from "express";
import fetchGitHubOrganizations from "./service";
import { OrganizationsResponse } from "rest-interfaces/oauth-types";
import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";
import errorWrapper from "express-async-handler";
import { UIDisplayableError } from "config/errors";

export const GitHubOrgsRouter = Router({ mergeParams: true });

GitHubOrgsRouter.get("/", errorWrapper(async (req: Request, res: Response<OrganizationsResponse>) => {
	const { githubToken, jiraHost, installation } = res.locals;
	const organizations = await fetchGitHubOrganizations(githubToken, jiraHost, installation, req.log);
	if (organizations) {
		res.status(200).send({
			orgs: organizations
		});
	}
}));

GitHubOrgsRouter.post("/", errorWrapper(async (req: Request, res: Response) => {
	const { installation, githubToken, gitHubAppId  } = res.locals;
	const gitHubInstallationId = Number(req.body.installationId);

	if (!githubToken) {
		req.log.warn("GitHub token wasn't found");
		throw new UIDisplayableError(401, "GitHub token is invalid or missing. Please re-authorised with GitHub");
	}

	if (!gitHubInstallationId) {
		req.log.warn("gitHubInstallationId wasn't found");
		throw new UIDisplayableError(400, "Missing installation ID");
	}

	const result = await verifyAdminPermsAndFinishInstallation(githubToken, installation, gitHubAppId, gitHubInstallationId, req.log);
	if (result.error) {
		throw new UIDisplayableError(400, result.error);
	} else {
		res.sendStatus(200);
	}
}));
