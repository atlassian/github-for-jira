import { Request, Response } from "express";

// BODY of req:
// "ids": ["XXXX", "YYYY"]
export const JiraSecurityWorkspacesRepositoriesPost = async (req: Request, res: Response): Promise<void> => {
	req.log.info({ method: req.method, requestUrl: req.originalUrl }, "Request started to POST repositories");

	res.status(200).json({
		success: true
	});
};

// Response

// {
// 	"containers": [
// 	{
// 		// Identifier of the security container which will be used to hydrate container details. This should be in this regex format: [a-zA-Z0-9\\-_.~@:{}=]+(/[a-zA-Z0-9\\-_.~@:{}=]+)*.
// 		id: "f730ce9c-3442-4f8a-93a4-a44f3b35c46b/target/111-222-333",
// 		// Human readable name of the container
// 		name: "my-container-name",
// 		// Url allowing Jira to link directly to the provider's container
// 		url: "https://my.security.provider.com/f730ce9c-3442-4f8a-93a4-a44f3b35c46b/container/f730ce9c-3442-4f8a-93a4-a44f3b35c46b",
// 		// Url providing the avatar for the container.
// 		avatarUrl: "https://res.cloudinary.com/snyk/image/upload/v1584038122/groups/Atlassian_Logo.png",
// 		// The date and time this container was last scanned/updated
// 		lastUpdatedDate: "2022-01-19T23:27:25+00:00"
// 	}
// ]
// }
