import Logger from "bunyan";
import { GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";
import { getLogger } from "~/src/config/logger";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { envVars } from "config/env";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { BooleanFlags, booleanFlag } from "config/feature-flags";

let useOutboundProxySkiplistFlagValue = false;
/**
 * A GitHub client superclass to encapsulate what differs between our GH clients
 */
export class GitHubClient {
	protected readonly logger: Logger;
	protected readonly restApiUrl: string;
	protected readonly graphqlUrl: string;
	protected readonly axios: AxiosInstance;

	constructor(
		logger: Logger = getLogger("gitHub-client"),
		baseUrl?: string,
		proxyBaseUrl?: string
	) {
		this.logger = logger;

		// baseUrl is undefined when FF is false
		// if FF is true and the githubAppId field is empty, it is set to https://api.github.com
		// TODO - clean this logic up once we remove the GHE_SERVER flag
		if (baseUrl == undefined || baseUrl === GITHUB_CLOUD_API_BASEURL) {
			this.restApiUrl = GITHUB_CLOUD_API_BASEURL;
			this.graphqlUrl = `${GITHUB_CLOUD_API_BASEURL}/graphql`;
		} else {
			this.restApiUrl = `${baseUrl}/api/v3`;
			this.graphqlUrl = `${baseUrl}/api/graphql`;
		}

		// Cannot make ctor async
		booleanFlag(BooleanFlags.USE_OUTBOUND_PROXY_SKIPLIST, false)
			?.then(value => useOutboundProxySkiplistFlagValue = value)
			?.catch((err) => {
				logger.warn({ err }, "Cannot evaluate FF");
			});

		this.axios = axios.create({
			baseURL: this.restApiUrl,
			transitional: {
				clarifyTimeoutError: true
			},
			... (
				useOutboundProxySkiplistFlagValue
					? this.buildProxyConfig(proxyBaseUrl)
					: this.getProxyConfig(this.restApiUrl)
			)
		});
	}

	private buildProxyConfig(proxyBaseUrl?: string): Partial<AxiosRequestConfig> {
		if (!proxyBaseUrl) {
			return this.noProxyConfig();
		}

		return {
			// Even though Axios provides the `proxy` option to configure a proxy, this doesn't work and will
			// always cause an HTTP 501 (see https://github.com/axios/axios/issues/3459). The workaround is to
			// create an HttpsProxyAgent and set the `proxy` option to false.
			httpAgent: new HttpProxyAgent(proxyBaseUrl),
			httpsAgent: new HttpsProxyAgent(proxyBaseUrl),
			proxy: false
		};
	}

	public getProxyConfig = (baseUrl: string): Partial<AxiosRequestConfig> => {
		if (new URL(baseUrl).host.endsWith("atlassian.com")) {
			return this.noProxyConfig();
		}
		return this.outboundProxyConfig();
	};

	private noProxyConfig = (): Partial<AxiosRequestConfig> => {
		return {
			// Not strictly necessary to set the agent to undefined, just to make it visible.
			httpsAgent: undefined,
			proxy: false
		};
	};

	private outboundProxyConfig = (): Partial<AxiosRequestConfig> => {
		const outboundProxyHttpsAgent = envVars.PROXY ? new HttpsProxyAgent(envVars.PROXY) : undefined;
		return {
			// Even though Axios provides the `proxy` option to configure a proxy, this doesn't work and will
			// always cause an HTTP 501 (see https://github.com/axios/axios/issues/3459). The workaround is to
			// create an HttpsProxyAgent and set the `proxy` option to false.
			httpsAgent: outboundProxyHttpsAgent,
			proxy: false
		};
	};
}
