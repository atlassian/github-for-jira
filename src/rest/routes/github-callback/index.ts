import { Router, Request, Response } from "express";
import sanitize from "sanitize-html";
import { errorWrapper } from "../../helper";
import { InvalidArgumentError } from "config/errors";

export const GitHubCallbackRoute = Router({ mergeParams: true });

GitHubCallbackRoute.get("/", errorWrapper("GitHubCallbackGet", async function GitHubCallbackGet(req: Request, res: Response<string>) {

	const code = String(req.query.code || "");
	const state = String(req.query.state || "");

	if (!code) {
		req.log.warn("Missing code in query");
		throw new InvalidArgumentError("Missing code in query");
	}

	if (!state) {
		req.log.warn("Missing state in query");
		throw new InvalidArgumentError("Missing state in query");
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

}));

