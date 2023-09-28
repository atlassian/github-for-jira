import { Router, Request, Response } from "express";
import fetchGitHubOrganizations from "./service";
import { OrganizationsResponse } from "rest-interfaces";
import { hasAdminAccess, verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";
import { errorWrapper } from "../../helper";
import { InvalidArgumentError, InsufficientPermissionError } from "config/errors";
import { BaseLocals } from "..";

export const GitHubOrgsRouter = Router({ mergeParams: true });

GitHubOrgsRouter.get("/", errorWrapper("GitHubOrgsFetchOrgs", async (req: Request, res: Response<OrganizationsResponse, BaseLocals>) => {
	const { githubToken, jiraHost, installation } = res.locals;
	const organizations = await fetchGitHubOrganizations(githubToken, jiraHost, installation, req.log);
	if (organizations) {
		res.status(200).send({
			orgs: organizations
		});
	}
}));

GitHubOrgsRouter.get("/ownership", errorWrapper("GitHubOrgsOwnership", async (req: Request, res: Response<OrganizationsResponse, BaseLocals>) => {
	const { githubToken, installation } = res.locals;
	const githubInstallationId = req.query.githubInstallationId;

	if (!githubInstallationId) {
		req.log.warn("Missing githubInstallationId in query");
		throw new InvalidArgumentError("Missing githubInstallationId in query");
	}

	if (!await hasAdminAccess(githubToken, installation.jiraHost, parseInt(githubInstallationId.toString()), req.log, undefined)) {
		req.log.warn(`User is not an admin of that installation`);
		throw new InsufficientPermissionError("Not admin of org");
	} else {
		res.sendStatus(200);
	}
}));

GitHubOrgsRouter.post("/", errorWrapper("GitHubOrgsConnectJira", async (req: Request, res: Response<OrganizationsResponse, BaseLocals>) => {
	const { installation, githubToken, gitHubAppId  } = res.locals;
	const body = req.body as { installationId: any };
	const gitHubInstallationId = Number(body.installationId);

	if (!gitHubInstallationId) {
		req.log.warn("gitHubInstallationId wasn't found");
		throw new InvalidArgumentError("Missing installation ID");
	}

	const result = await verifyAdminPermsAndFinishInstallation(githubToken, installation, gitHubAppId, gitHubInstallationId, true, req.log);
	if (result.errorCode === "NOT_ADMIN") {
		throw new InsufficientPermissionError(result.error || "Not admin of org");
	} else {
		res.sendStatus(200);
	}
}));
