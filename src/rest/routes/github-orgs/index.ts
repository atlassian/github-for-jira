import { Router, Request, Response } from "express";
import fetchGitHubOrganizations from "./service";
import { OrganizationsResponse } from "rest-interfaces";
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

GitHubOrgsRouter.post("/", errorWrapper("GitHubOrgsConnectJira", async (req: Request, res: Response<OrganizationsResponse, BaseLocals>) => {
	const { installation, githubToken, gitHubAppId  } = res.locals;
	const body = req.body as { installationId: unknown };
	const gitHubInstallationId = Number(body.installationId);

	if (!gitHubInstallationId) {
		req.log.warn("gitHubInstallationId wasn't found");
		throw new InvalidArgumentError("Missing installation ID");
	}

	const result = await verifyAdminPermsAndFinishInstallation(githubToken, installation, gitHubAppId, gitHubInstallationId, req.log);
	if (result.errorCode === "NOT_ADMIN") {
		throw new InsufficientPermissionError(result.error || "Not admin of org");
	} else {
		res.sendStatus(200);
	}
}));
