import Logger from "bunyan";
import { getLogger } from "~/src/config/logger";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { envVars } from "config/env";
import { HttpsProxyAgent } from "https-proxy-agent";
import { GraphQlQueryResponse } from "~/src/github/client/github-client.types";
import { GithubClientGraphQLError, RateLimitingError } from "~/src/github/client/github-client-errors";

export interface GitHubConfig {
	hostname: string;
	baseUrl: string;
	apiUrl: string;
	graphqlUrl: string;
}

/**
 * A GitHub client superclass to encapsulate what differs between our GH clients
 */
export class GitHubClient {
	protected readonly logger: Logger;
	protected readonly restApiUrl: string;
	protected readonly graphqlUrl: string;
	protected readonly axios: AxiosInstance;

	constructor(
		gitHubConfig: GitHubConfig,
		logger: Logger = getLogger("gitHub-client")
	) {
		this.logger = logger;

		this.restApiUrl = gitHubConfig.apiUrl;
		this.graphqlUrl = gitHubConfig.graphqlUrl;

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

	protected async graphql<T>(query: string, config: AxiosRequestConfig, variables?: Record<string, string | number | undefined>): Promise<AxiosResponse<GraphQlQueryResponse<T>>> {
		const response = await this.axios.post<GraphQlQueryResponse<T>>(this.graphqlUrl,
			{
				query,
				variables
			},
			config);

		const graphqlErrors = response.data?.errors;
		if (graphqlErrors?.length) {
			this.logger.warn({ res: response }, "GraphQL errors");
			if (graphqlErrors.find(err => err.type == "RATE_LIMITED")) {
				return Promise.reject(new RateLimitingError(response));
			}

			const graphQlErrorMessage = graphqlErrors[0].message + (graphqlErrors.length > 1 ? ` and ${graphqlErrors.length - 1} more errors` : "");
			return Promise.reject(new GithubClientGraphQLError(graphQlErrorMessage, graphqlErrors));
		}

		return response;
	}
}
