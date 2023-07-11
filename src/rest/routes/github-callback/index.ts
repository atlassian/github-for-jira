import { Router, Request, Response } from "express";
import { getAccessToken } from "~/src/rest/routes/github-callback/service";

export const GitHubCallbackRoute = Router({ mergeParams: true });

GitHubCallbackRoute.get("/", async (req: Request, res: Response) => {
	try {
		const data = await getAccessToken("https://github.com/login/oauth/access_token", req);

		/**
		 * A static page,
		 * which simply sends the tokens back to the parent window
		 * and then closes itself
		 */
		res.send(`
		<html>
			<body></body>
			<script>
				window.opener.postMessage(${JSON.stringify(data)}, window.origin);
				window.close();
			</script>
		</html>
	`);
	} catch (error) {
		res.send(500).json(error);
	}
});

