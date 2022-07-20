import { envVars }  from "./env";
import { AxiosRequestConfig } from "axios";

// if (envVars.PROXY) {
// 	logger.info(`configuring proxy: ${envVars.PROXY} for outbound calls`);
// 	process.env.GLOBAL_AGENT_HTTP_PROXY = envVars.PROXY;
// 	bootstrap();
// } else {
// 	logger.info("configuring no proxy for outbound calls");
// }

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


