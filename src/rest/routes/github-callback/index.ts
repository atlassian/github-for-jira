import { Router, Request, Response } from "express";

export const GitHubCallbackRoute = Router({ mergeParams: true });

GitHubCallbackRoute.get("/", async function GitHubCallbackGet(req: Request, res: Response) {

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
					window.opener.postMessage(${JSON.stringify({ code, state })}, window.origin);
					window.close();
				</script>
			</html>
		`);

	} catch (error) {
		res.send(500).json(error);
	}
});

