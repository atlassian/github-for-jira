import Logger from "bunyan";
import { getLogger } from "~/src/config/logger";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { envVars } from "config/env";
import { HttpsProxyAgent } from "https-proxy-agent";
import { GraphQlQueryResponse } from "~/src/github/client/github-client.types";
import { GithubClientGraphQLError, RateLimitingError } from "~/src/github/client/github-client-errors";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export interface GitHubConfig {
	hostname: string;
	baseUrl: string;
	apiUrl: string;
	graphqlUrl: string;
}

const GITHUB_CLOUD_API_BASEURL = "https://api.github.com"; // will go away once we start using GitHubConfig without FF

let useGitHubConfigInBaseClientFlagValue = false;

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
		logger: Logger = getLogger("gitHub-client"),
		baseUrl?: string // goes away when we remove FF
	) {
		this.logger = logger;

		// constructor cannot be async, therefore cannot use await
		booleanFlag(BooleanFlags.USE_GITHUB_CONFIG_IN_BASE_CLIENT, false)
			// "?." to avoid multiple tests that mock feature flags to go red
			?.then(flagValue => {
				useGitHubConfigInBaseClientFlagValue = flagValue;
			})
			?.catch((err) => {
				logger.warn({ err }, "Cannot evaluate FF");
			});

		// baseUrl is undefined when FF is false
		// if FF is true and the githubAppId field is empty, it is set to https://api.github.com
		// TODO - clean this logic up once we remove the GHE_SERVER flag

		if (useGitHubConfigInBaseClientFlagValue) {
			this.restApiUrl = gitHubConfig.apiUrl;
			this.graphqlUrl = gitHubConfig.graphqlUrl;
		} else {
			if (baseUrl == undefined || baseUrl === GITHUB_CLOUD_API_BASEURL) {
				this.restApiUrl = GITHUB_CLOUD_API_BASEURL;
				this.graphqlUrl = `${GITHUB_CLOUD_API_BASEURL}/graphql`;
			} else {
				this.restApiUrl = `${baseUrl}/api/v3`;
				this.graphqlUrl = `${baseUrl}/api/graphql`;
			}
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
