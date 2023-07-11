import { Router, Request, Response } from "express";
import { finishOAuthFlow } from "~/src/rest/routes/github-callback/service";

export const GitHubCallbackRoute = Router({ mergeParams: true });

GitHubCallbackRoute.get("/", async (req: Request, res: Response) => {

	try {

		const code = String(req.query.code || "");
		const state = String(req.query.state || "");

		if (!code) {
			req.log.warn("Missing code in query");
			res.status(400).send("Missing code in queryFail acquire access token");
		}

		const data = await finishOAuthFlow(undefined, code, state, req.log);

		if (data === null) {
			req.log.warn("Fail to finish oauth flow");
			res.status(400).send("Fail acquire access token");
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
					window.opener.postMessage(${JSON.stringify(data)}, window.origin);
					window.close();
				</script>
			</html>
		`);

	} catch (error) {
		res.send(500).json(error);
	}
});

