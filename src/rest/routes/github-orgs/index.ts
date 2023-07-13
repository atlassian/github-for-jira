import { Router, Request, Response } from "express";
import fetchGitHubOrganizations from "./service";
import { OrganizationsResponse } from "rest-interfaces/oauth-types";
import { GithubConfigurationPost } from "routes/github/configuration/github-configuration-post";

export const GitHubOrgsRouter = Router({ mergeParams: true });

GitHubOrgsRouter.get("/", async (req: Request, res: Response<OrganizationsResponse>) => {
	const { githubToken, jiraHost, installation } = res.locals;
	const organizations = await fetchGitHubOrganizations(githubToken, jiraHost, installation, req.log);

	// TODO: Need to handle all the different error cases
	res.status(200).send({
		orgs: organizations
	});
});


GitHubOrgsRouter.post("/", GithubConfigurationPost);
