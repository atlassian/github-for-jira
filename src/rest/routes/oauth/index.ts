import { Router, Request, Response } from "express";
import { getRedirectUrl, finishOAuthFlow } from "./service";

export const OAuthRouter = Router({ mergeParams: true });

OAuthRouter.get("/redirectUrl", async (req: Request, res: Response) => {

	const cloudOrUUID = req.params.cloudOrUUID;

	const gheUUID = cloudOrUUID === "cloud" ? undefined : "some-ghe-uuid"; //TODO: validate the uuid regex

	res.status(200).json(await getRedirectUrl(gheUUID));
});

OAuthRouter.post("/exchangeToken", async (req: Request, res: Response) => {

	try {

		const code = req.body.code || "";
		const state = req.body.state || "";

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
