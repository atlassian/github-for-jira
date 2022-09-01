import { AxiosInstance, AxiosRequestConfig } from "axios";
import url from "url";
import { createQueryStringHash, encodeSymmetric } from "atlassian-jwt";
import { envVars }  from "config/env";

const instance = envVars.INSTANCE_NAME;
const iss = `com.github.integration${instance ? `.${instance}` : ""}`;

/**
 * Middleware to create a custom JWT for a request.
 */
export const jiraAuthMiddleware = (secret: string, instance: AxiosInstance) =>
	(config: AxiosRequestConfig): AxiosRequestConfig => {
		// Generate full URI based on current config
		const uri = instance.getUri(config);
		// parse the URI and get query/path
		const { query, pathname } = url.parse(uri, true);

		const jwtToken = encodeSymmetric(
			{
				...getExpirationInSeconds(),
				iss,
				qsh: createQueryStringHash({
					method: config.method || "GET", // method can be undefined, defaults to GET
					pathname: pathname || undefined,
					query
				})
			},
			secret
		);

		// Set authorization headers
		config.headers = config.headers || {};
		config.headers.Authorization = `JWT ${jwtToken}`;
		return config;
	};

/*
 * The Atlassian API uses JSON Web Tokens (JWT) for authentication along with
 * Query String Hashing (QSH) to prevent URL tampering. IAT, or issued-at-time,
 * is a Unix-style timestamp of when the token was issued. EXP, or expiration
 * time, is a Unix-style timestamp of when the token expires and must be no
 * more than three minutes after the IAT.
 */
const getExpirationInSeconds = () => {
	const nowInSeconds = Math.floor(Date.now() / 1000);
	return {
		iat: nowInSeconds,
		exp: nowInSeconds + 3 * 60 // 3 minutes
	};
};
