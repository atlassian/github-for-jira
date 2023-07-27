import { Router, Request, Response, NextFunction } from "express";
import { getRedirectUrl, finishOAuthFlow } from "./service";
import { GetRedirectUrlResponse, ExchangeTokenResponse  } from "rest-interfaces/oauth-types";

export const OAuthRouter = Router({ mergeParams: true });

OAuthRouter.get("/redirectUrl", async function OAuthRedirectUrl(req: Request, res: Response<GetRedirectUrlResponse>) {
	const cloudOrUUID = req.params.cloudOrUUID;
	const { jiraHost } = res.locals;
	const gheUUID = cloudOrUUID === "cloud" ? undefined : "some-ghe-uuid"; //TODO: validate the uuid regex

	res.status(200).json(await getRedirectUrl(jiraHost, gheUUID));
});

OAuthRouter.post("/exchangeToken", async function OAuthExchangeToken(req: Request, res: Response<ExchangeTokenResponse>, next: NextFunction) {
	try {
		const code = req.body.code || "";
		const state = req.body.state || "";

		const { jiraHost } = res.locals;

		if (!code) {
			req.log.warn("Missing code in query");
			next({ status: 401, message: "Missing code in query" });
		}

		const data = await finishOAuthFlow(jiraHost, undefined, code, state, req.log, next);

		if (data) {
			res.status(200).json({
				accessToken: data?.accessToken,
				refreshToken: data?.refreshToken
			});
		} else {
			req.log.warn("Failed to finish oauth flow");
			next({ status: 401, message: "Failed to finish OAuth flow" });
		}
	} catch (error) {
		req.log.error({ err: error }, "Failed during exchanging token");
		next({ status: 401, message: "Failed during exchanging token" });
	}
});
