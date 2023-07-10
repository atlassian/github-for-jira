import { Request } from "express";
import { envVars } from "config/env";
import axios from "axios";

const GITHUB_CLOUD_LOGIN_URL = "https://github.com/login/oauth/access_token";
export const getAccessToken = async (req: Request) => {
	const { code } = req.query;
	if (!code) {
		req.log.error("No code provided!");
	}

	try {
		const response = await axios.post(GITHUB_CLOUD_LOGIN_URL, {
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
