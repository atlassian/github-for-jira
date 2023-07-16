import { Router, Request, Response } from "express";
import fetchGitHubOrganizations from "./service";
import { OrganizationsResponse } from "rest-interfaces/oauth-types";
import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";

export const GitHubOrgsRouter = Router({ mergeParams: true });

GitHubOrgsRouter.get("/", async (req: Request, res: Response<OrganizationsResponse>) => {
	const { githubToken, jiraHost, installation } = res.locals;
	const organizations = await fetchGitHubOrganizations(githubToken, jiraHost, installation, req.log);

	// TODO: Need to handle all the different error cases
	res.status(200).send({
		orgs: organizations
	});
});


GitHubOrgsRouter.post("/", async (req: Request, res: Response) => {
	const { installation, githubToken, gitHubAppId  } = res.locals;
	const gitHubInstallationId = Number(req.body.installationId);

	if (!githubToken) {
		req.log.warn("GitHub token wasn't found");
		res.sendStatus(401);
		return;
	}

	if (!gitHubInstallationId) {
		req.log.warn("gitHubInstallationId wasn't found");
		res.status(400)
			.json({
				err: "An Installation ID must be provided to link an installation."
			});
		return;
	}

	const result = await verifyAdminPermsAndFinishInstallation(githubToken, installation, gitHubAppId, gitHubInstallationId, req.log);
	if (result.error) {
		res.status(401)
			.json({
				err: result.error
			});
		return;
	}

	res.sendStatus(200);
});
