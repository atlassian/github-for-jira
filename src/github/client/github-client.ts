import Logger from "bunyan";
import { getLogger } from "~/src/config/logger";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { GraphQlQueryResponse } from "~/src/github/client/github-client.types";
import { GithubClientGraphQLError, RateLimitingError } from "~/src/github/client/github-client-errors";

export interface GitHubClientApiKeyConfig {
	headerName: string;
	apiKeyGenerator: () => Promise<string>;
}

export interface GitHubConfig {
	hostname: string;
	baseUrl: string;
	apiUrl: string;
	graphqlUrl: string;
	proxyBaseUrl?: string;
	apiKeyConfig?: GitHubClientApiKeyConfig;
}

/**
 * A GitHub client superclass to encapsulate what differs between our GH clients
 */
export class GitHubClient {
	protected readonly logger: Logger;

	// For GHES must always be equal to gitHubBaseUrl::gitHubBaseUrl
	// For Cloud must always be equal to GITHUB_CLOUD_BASEURL
	public readonly baseUrl: string;

	protected readonly restApiUrl: string;
	protected readonly graphqlUrl: string;
	protected readonly axios: AxiosInstance;

	constructor(
		gitHubConfig: GitHubConfig,
		logger: Logger = getLogger("gitHub-client")
	) {
		this.logger = logger;
		this.baseUrl = gitHubConfig.baseUrl;
		this.restApiUrl = gitHubConfig.apiUrl;
		this.graphqlUrl = gitHubConfig.graphqlUrl;

		this.axios = axios.create({
			baseURL: this.restApiUrl,
			transitional: {
				clarifyTimeoutError: true
			},
			... (gitHubConfig.proxyBaseUrl ? this.buildProxyConfig(gitHubConfig.proxyBaseUrl) : {})
		});

		// Temp logging to calculate the number of requests we are making during backfilling per hour so the support
		// could ask GH for an extension for big customers
		this._addLogging();

		if (gitHubConfig.apiKeyConfig) {
			logger.info("Use API key");
			const apiKeyConfig = gitHubConfig.apiKeyConfig;
			this.axios.interceptors.request.use(async (config) => {
				if (!config.headers) {
					config.headers = {};
				}
				config.headers[apiKeyConfig.headerName] = await apiKeyConfig.apiKeyGenerator();
				return config;
			});
		}
	}

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
				return Promise.reject(new RateLimitingError(config, response));
			}

			const graphQlErrorMessage = graphqlErrors[0].message + (graphqlErrors.length > 1 ? ` and ${graphqlErrors.length - 1} more errors` : "");
			return Promise.reject(new GithubClientGraphQLError(config, graphQlErrorMessage, graphqlErrors));
		}

		return response;
	}

	private buildProxyConfig(proxyBaseUrl: string): Partial<AxiosRequestConfig> {
		const proxyHttpAgent = new HttpProxyAgent(proxyBaseUrl);
		const proxyHttpsAgent = new HttpsProxyAgent(proxyBaseUrl);
		return {
			// Even though Axios provides the `proxy` option to configure a proxy, this doesn't work and will
			// always cause an HTTP 501 (see https://github.com/axios/axios/issues/3459). The workaround is to
			// create an Http(s?)ProxyAgent and set the `proxy` option to false.
			httpAgent: proxyHttpAgent,
			httpsAgent: proxyHttpsAgent,
			proxy: false
		};
	}

	private _addLogging() {
		this.axios.interceptors.request.use(config => {
			this.logger.info("making a request to GH");
			return config;
		});
		this.axios.interceptors.response.use(response => {
			if (response?.headers["x-ratelimit-remaining"]) {
				this.logger.info(`x-rate-limit-remaining: ${response?.headers["x-ratelimit-remaining"]}`);
			}
			if (response?.headers["x-ratelimit-reset"]) {
				this.logger.info(`x-rate-limit-reset: ${response?.headers["x-ratelimit-remaining"]}`);
			}
			return response;
		}, err => {
			this.logger.info({ err }, "Request to GitHub was failed!");
			return Promise.reject(err);
		});
	}
}
