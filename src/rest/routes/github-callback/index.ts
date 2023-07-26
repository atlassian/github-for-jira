import { Router, Request, Response } from "express";
import sanitize from "sanitize-html";

export const GitHubCallbackRoute = Router({ mergeParams: true });

GitHubCallbackRoute.get("/", async function GitHubCallbackGet(req: Request, res: Response<string>) {

	try {

		const code = String(req.query.code || "");
		const state = String(req.query.state || "");

		if (!code) {
			req.log.warn("Missing code in query");
			res.status(400).send("Missing code in queryFail acquire access token");
		}

		/**
		 * A static page,
		 * which simply sends the tokens back to the parent window
		 * and then closes itself
		 */
		res.status(200).send(`
			<html>
				<body></body>
				<script>
					window.opener.postMessage(${JSON.stringify({ type: "oauth-callback", code: sanitize(code), state: sanitize(state) })}, window.origin);
					window.close();
				</script>
			</html>
		`);

	} catch (error) {
		req.log.error({ err: error }, "Error parsing callback from github");
		res.status(500).send("Error handling github oauth callback");
	}
});

