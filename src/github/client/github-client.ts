import Logger from "bunyan";
import { GITHUB_CLOUD_API_BASEURL } from "utils/get-github-client-config";
import { getLogger } from "~/src/config/logger";
import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { envVars } from "config/env";
import { HttpsProxyAgent } from "https-proxy-agent";

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
		baseUrl?: string
	) {
		this.logger = logger;

		// baseUrl is undefined when FF is false
		// if FF is true and the githubAppId field is empty, it is set to https://api.github.com
		// TODO - clean this logic up once we remove the GHE_SERVER flag
		if (baseUrl == undefined || baseUrl === "https://api.github.com") {
			this.restApiUrl = GITHUB_CLOUD_API_BASEURL;
			this.graphqlUrl = `${GITHUB_CLOUD_API_BASEURL}/graphql`;
		} else {
			this.restApiUrl = `${baseUrl}/api/v3`;
			this.graphqlUrl = `${baseUrl}/api/graphql`;
		}

		this.axios = axios.create({
			baseURL: this.restApiUrl,
			transitional: {
				clarifyTimeoutError: true
			},
			... this.getProxyConfig(this.restApiUrl)
		});
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
