import { Router, Request, Response } from "express";
import { checkGitHubOrgOwnership, fetchGitHubOrganizations } from "./service";
import {
	OrganizationsResponse,
	OrgOwnershipResponse
} from "rest-interfaces";
import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";
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

GitHubOrgsRouter.get("/ownership", errorWrapper("GitHubOrgsOwnership", async (req: Request, res: Response<OrgOwnershipResponse, BaseLocals>) => {
	const { githubToken, installation: { jiraHost } } = res.locals;

	if (!req.query.githubInstallationId) {
		req.log.warn("Missing githubInstallationId in query");
		throw new InvalidArgumentError("Missing githubInstallationId in query");
	}
	const githubInstallationId = parseInt(req.query.githubInstallationId.toString());

	const { isAdmin, orgName } = await checkGitHubOrgOwnership(githubToken, jiraHost, githubInstallationId, req.log);

	if (!isAdmin) {
		req.log.warn(`User is not an admin of that installation`);
		res.status(403).json({ orgName });
	} else {
		res.status(200).json({ orgName });
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
