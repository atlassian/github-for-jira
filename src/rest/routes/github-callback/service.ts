import { Request } from "express";
import { envVars } from "config/env";
import axios from "axios";

type TokenType = {
	accessToken: string;
	refreshToken: string;
};

export const getAccessToken = async (url: string, req: Request): Promise<TokenType | null> => {
	const { code } = req.query;
	if (!code) {
		req.log.error("No code provided!");
		return null;
	}

	try {
		const response = await axios.post(url, {
			code: req.query.code,
			client_id: envVars.GITHUB_CLIENT_ID,
			client_secret: envVars.GITHUB_CLIENT_SECRET
		});

		// Result comes as a string `access_token=XXXXXX&refresh_token=XXXXX`
		const tokenObj = Object.fromEntries(new URLSearchParams(response.data));

		if (!tokenObj.access_token || !tokenObj.refresh_token) {
			throw new Error(response.data);
		}

		return {
			accessToken: tokenObj.access_token,
			refreshToken: tokenObj.refresh_token
		};
	} catch (error) {
		req.log.warn({ error }, "Failed to renew Github token...");
		return null;
	}
};
