import { envVars }  from "./env";
import { AxiosRequestConfig } from "axios";

/**
 * Use this Axios config to make HTTP(S) requests via the configured outbound proxy.
 */
export const OUTBOUND_PROXY_CONFIG: Partial<AxiosRequestConfig> = {
	proxy: {
		protocol: "http",
		host: envVars.OUTBOUND_PROXY_HOST,
		port: Number(envVars.OUTBOUND_PROXY_PORT)
	}
};

/**
 * Use this Axios config to NOT use a proxy for HTTP(S) calls.
 */
export const NO_PROXY_CONFIG: Partial<AxiosRequestConfig> = {
	proxy: undefined
};

