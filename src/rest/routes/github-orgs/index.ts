import { Router, Request, Response, NextFunction } from "express";
import fetchGitHubOrganizations from "./service";
import { OrganizationsResponse } from "rest-interfaces/oauth-types";
import { verifyAdminPermsAndFinishInstallation } from "services/subscription-installation-service";

export const GitHubOrgsRouter = Router({ mergeParams: true });

GitHubOrgsRouter.get("/", async (req: Request, res: Response<OrganizationsResponse>, next: NextFunction) => {
	const { githubToken, jiraHost, installation } = res.locals;
	try {
		const organizations = await fetchGitHubOrganizations(githubToken, jiraHost, installation, req.log, next);
		if (organizations) {
			res.status(200).send({
				orgs: organizations
			});
		}
	} catch (e) {
		req.log.error({ err: e }, "Failed to fetch the organizations");
		next(e);
	}
});

GitHubOrgsRouter.post("/", async (req: Request, res: Response, next: NextFunction) => {
	const { installation, githubToken, gitHubAppId  } = res.locals;
	const gitHubInstallationId = Number(req.body.installationId);

	if (!githubToken) {
		req.log.warn("GitHub token wasn't found");
		next({ status: 401, message: "Missing code in query" });
	}

	if (!gitHubInstallationId) {
		req.log.warn("gitHubInstallationId wasn't found");
		next({ status: 400, message: "Missing installation ID" });
	}

	const result = await verifyAdminPermsAndFinishInstallation(githubToken, installation, gitHubAppId, gitHubInstallationId, req.log);
	if (result.error) {
		next({ status: 400, message: result.error });
	} else {
		res.sendStatus(200);
	}
});
