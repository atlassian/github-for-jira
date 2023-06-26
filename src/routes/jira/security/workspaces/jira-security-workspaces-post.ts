import { Request, Response } from "express";

// BODY of req:
// "ids": ["XXXX", "YYYY"]
export const JiraSecurityWorkspacesPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started for POST workspaces");

	res.status(200).json({ success: true });
};

// response payload:
// {
// 	"workspaces": [
// 	{
// 		// Identifier of the security workspace which will be used to hydrate workspace details
// 		id: "f730ce9c-3442-4f8a-93a4-a44f3b35c46b"
// 		// Human readable name of the workspace
// 		name: "economy-security-scanning"
// 		// Url allowing Jira to link directly to the provider's workspace
// 		url: "https://my.security.provider.com/org/f730ce9c-3442-4f8a-93a4-a44f3b35c46b"
// 		// Url providing the avatar for the workspace.
// 		avatarUrl: "https://res.cloudinary.com/snyk/image/upload/v1584038122/groups/Atlassian_Logo.png"
// 	}
// ]
// }
