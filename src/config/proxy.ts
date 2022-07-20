import { envVars }  from "./env";
import { AxiosRequestConfig } from "axios";
import { HttpsProxyAgent } from "https-proxy-agent";

const outboundProxyHttpsAgent = envVars.PROXY ? new HttpsProxyAgent(envVars.PROXY) : undefined;

/**
 * Use this Axios config to make HTTP(S) requests via the configured outbound proxy.
 */
export const OUTBOUND_PROXY_CONFIG: Partial<AxiosRequestConfig> = {
	// Even though Axios provides the `proxy` option to configure a proxy, this doesn't work and will
	// always cause an HTTP 501 (see https://github.com/axios/axios/issues/3459). The workaround is to
	// create an HttpsProxyAgent and set the `proxy` option to false.
	httpsAgent: outboundProxyHttpsAgent,
	proxy: false
};

/**
 * Use this Axios config to NOT use a proxy for HTTP(S) calls.
 */
export const NO_PROXY_CONFIG: Partial<AxiosRequestConfig> = {
	// Not strictly necessary to set the agent to undefined, just to make it visible.
	httpsAgent: undefined,
	proxy: false
};


