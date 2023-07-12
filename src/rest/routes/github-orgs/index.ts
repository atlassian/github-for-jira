import { Router, Request, Response } from "express";
import fetchGitHubOrganizations from "./service";
import { OrganizationsResponse } from "rest-interfaces/oauth-types";

export const GitHubOrgsRouter = Router({ mergeParams: true });

GitHubOrgsRouter.get("/", async (req: Request, res: Response<OrganizationsResponse>) => {
	const { githubToken, jiraHost } = res.locals;
	const organizations = await fetchGitHubOrganizations(githubToken, jiraHost, req.log);

	res.status(200).send({
		orgs: organizations
	});
});

