import { Router, Request, Response } from "express";
import { getRedirectUrl, finishOAuthFlow } from "./service";
import { GetRedirectUrlResponse, ExchangeTokenResponse  } from "rest-interfaces/oauth-types";

export const OAuthRouter = Router({ mergeParams: true });

OAuthRouter.get("/redirectUrl", async function OAuthRedirectUrl(req: Request, res: Response<GetRedirectUrlResponse>) {

	const cloudOrUUID = req.params.cloudOrUUID;

	const gheUUID = cloudOrUUID === "cloud" ? undefined : "some-ghe-uuid"; //TODO: validate the uuid regex

	res.status(200).json(await getRedirectUrl(gheUUID));
});

OAuthRouter.post("/exchangeToken", async function OAuthExchangeToken(req: Request, res: Response<ExchangeTokenResponse | string>) {

	try {
		const code = req.body.code || "";
		const state = req.body.state || "";

		if (!code) {
			req.log.warn("Missing code in query");
			res.status(400).send("Missing code in queryFail acquire access token");
			return;
		}

		const data = await finishOAuthFlow(undefined, code, state, req.log);

		if (data === null) {
			req.log.warn("Fail to finish oauth flow");
			res.status(400).send("Fail acquire access token");
			return;
		}

		res.status(200).json({
			accessToken: data?.accessToken,
			refreshToken: data?.refreshToken
		});

	} catch (error) {
		req.log.error({ err: error }, "Fail during exchanging token");
		res.status(500).send("Fail to acquire access token");
	}
});
