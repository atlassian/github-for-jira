import { Request, Response } from "express";
import { v4 as uuidv4 } from "uuid";
import { envVars } from "~/src/config/env";

export const GithubManifestGet = async (req: Request, res: Response) => {
	const gheHost = req.query.gheHost as string;
	if (!gheHost) {
		throw new Error("GHE URL not found");
	}
	const manifest = getAppManifest();
	req.session.temp = { gheHost };
	res.json(manifest);
};

const getAppManifest = () => {
	const appHost = envVars.APP_URL;
	const uuid=  uuidv4();
	return {
		"name": "Jira",
		"url": "https://github.com/marketplace/jira-software-github",
		"redirect_url": `${appHost}/github/manifest/${uuid}/complete`,
		"hook_attributes": {
			"url": `${appHost}/github/${uuid}/webhooks`
		},
		"setup_url": `${appHost}/github/${uuid}/setup`,
		"callback_url": `${appHost}/github/${uuid}/callback`,
		"public": true,
		"default_permissions": {
			"actions": "read",
			"security_events": "read",
			"contents": "write",
			"deployments": "read",
			"issues": "write",
			"metadata": "read",
			"pull_requests": "write",
			"members": "read"
		},
		"default_events": [
			"code_scanning_alert",
			"commit_comment",
			"create",
			"delete",
			"deployment_status",
			"issue_comment",
			"issues",
			"pull_request",
			"pull_request_review",
			"push",
			"repository",
			"workflow_run"
		]
	};

};
