import { Router, Request, Response } from "express";
import { getRedirectUrl, finishOAuthFlow } from "./service";
import { GetRedirectUrlResponse, ExchangeTokenResponse  } from "rest-interfaces";
import { errorWrapper } from "../../helper";
import { InvalidArgumentError } from "config/errors";

export const OAuthRouter = Router({ mergeParams: true });

OAuthRouter.get("/redirectUrl", errorWrapper("OAuthRedirectUrl", async function OAuthRedirectUrl(req: Request, res: Response<GetRedirectUrlResponse>) {

	const cloudOrUUID = req.params.cloudOrUUID;
	const jiraHost = res.locals["jiraHost"] as string | undefined;
	if (jiraHost === undefined) {
		throw new InvalidArgumentError("Missing jiraHost");
	}
	const gheUUID = cloudOrUUID === "cloud" ? undefined : "some-ghe-uuid"; //TODO: validate the uuid regex

	res.status(200).json(await getRedirectUrl(jiraHost, gheUUID));
}));

OAuthRouter.post("/exchangeToken", errorWrapper("OAuthExchangeToken", async function OAuthExchangeToken(req: Request, res: Response<ExchangeTokenResponse>) {

	const body = req.body as { code?: string, state?: string } | undefined;
	const code = body?.code;
	const state = body?.state;

	const jiraHost = res.locals["jiraHost"] as string | undefined;
	if (jiraHost === undefined) {
		throw new InvalidArgumentError("Missing jiraHost");
	}

	if (!code) {
		req.log.warn("Missing code in query");
		throw new InvalidArgumentError("Missing code in query");
	}

	if (!state) {
		req.log.warn("Missing state in query");
		throw new InvalidArgumentError("Missing state in query");
	}

	const data = await finishOAuthFlow(jiraHost, undefined, code, state, req.log);

	res.status(200).json({
		accessToken: data.accessToken,
		refreshToken: data.refreshToken
	});

}));
