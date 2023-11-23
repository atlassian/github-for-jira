import Logger from "bunyan";
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from "axios";
import { HttpProxyAgent } from "http-proxy-agent";
import { HttpsProxyAgent } from "https-proxy-agent";
import { GraphQlQueryResponse } from "~/src/github/client/github-client.types";
import {
	buildAxiosStubErrorForGraphQlErrors,
	GithubClientBlockedIpError,
	GithubClientGraphQLError,
	GithubClientInvalidPermissionsError,
	GithubClientNotFoundError,
	GithubClientRateLimitingError,
	GithubClientSSOLoginError
} from "~/src/github/client/github-client-errors";
import {
	handleFailedRequest,
	instrumentFailedRequest,
	instrumentRequest,
	setRequestStartTime,
	setRequestTimeout
} from "~/src/github/client/github-client-interceptors";
import { urlParamsMiddleware } from "utils/axios/url-params-middleware";
import { metricHttpRequest } from "config/metric-names";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import fs from "fs";
import * as https from "https";
import { getLogger } from "config/logger";

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

export interface Metrics {
	trigger: string,
	subTrigger?: string,
}

class HttpsProxyAgentWithCustomCA extends HttpsProxyAgent {
	private ca;
	constructor(_opts, ca) {
		super(_opts);
		this.ca = ca;
	}
	callback(req, opts) {
		return super.callback(req, { ... opts, ca: this.ca });
	}
}

let certs: Buffer | undefined = undefined;
try {
	certs = fs.readFileSync("node_modules/node_extra_ca_certs_mozilla_bundle/ca_bundle/ca_intermediate_root_bundle.pem");
	getLogger("github-client").warn("the bundle is loaded");
} catch (err: unknown) {
	getLogger("github-client").error({ err }, "cannot read certificate bundle");
}

/**
 * A GitHub client superclass to encapsulate what differs between our GH clients
 */
export class GitHubClient {
	protected readonly logger: Logger;

	// For GHES must always be equal to gitHubBaseUrl::gitHubBaseUrl
	// For Cloud must always be equal to GITHUB_CLOUD_BASEURL
	public readonly baseUrl: string;

	public readonly restApiUrl: string;
	protected readonly graphqlUrl: string;
	protected readonly axios: AxiosInstance;
	protected readonly metrics: Metrics;

	constructor(
		gitHubConfig: GitHubConfig,
		jiraHost: string | undefined,
		metrics: Metrics,
		logger: Logger
	) {
		this.logger = logger;
		this.baseUrl = gitHubConfig.baseUrl;
		this.restApiUrl = gitHubConfig.apiUrl;
		this.graphqlUrl = gitHubConfig.graphqlUrl;
		this.metrics = metrics;

		this.axios = axios.create({
			baseURL: this.restApiUrl,
			transitional: {
				clarifyTimeoutError: true
			},
			... (gitHubConfig.proxyBaseUrl ? this.buildProxyConfig(gitHubConfig.proxyBaseUrl) : {})
		});

		// HOT-105065
		if (certs) {
			this.axios.interceptors.request.use(async (config: AxiosRequestConfig): Promise<AxiosRequestConfig> => {
				try {
					if (await booleanFlag(BooleanFlags.USE_CUSTOM_ROOT_CA_BUNDLE, gitHubConfig.baseUrl)) {
						this.logger.info("Using proxy with custom CA");
						config.httpsAgent = gitHubConfig.proxyBaseUrl
							? new HttpsProxyAgentWithCustomCA(gitHubConfig.proxyBaseUrl, certs)
							: new https.Agent({
								ca: certs
							});
					}
				} catch (err: unknown) {
					this.logger.error({ err }, "HOT-105065: should never happen, but just in case cause we don't have test for this");
				}
				return config;
			});
		}

		this.axios.interceptors.request.use(setRequestStartTime);
		this.axios.interceptors.request.use(setRequestTimeout);
		this.axios.interceptors.request.use(urlParamsMiddleware);
		this.axios.interceptors.response.use(
			undefined,
			handleFailedRequest(this.logger)
		);
		this.axios.interceptors.response.use(
			instrumentRequest(metricHttpRequest.github, this.restApiUrl, jiraHost, {
				withApiKey: (!!gitHubConfig.apiKeyConfig).toString(),
				...this.metrics
			}),
			instrumentFailedRequest(metricHttpRequest.github, this.restApiUrl, jiraHost, {
				withApiKey: (!!gitHubConfig.apiKeyConfig).toString(),
				...this.metrics
			})
		);

		if (gitHubConfig.apiKeyConfig) {
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

	protected async graphql<T>(query: string, config: AxiosRequestConfig, variables?: Record<string, string | number | undefined>, metrics?: Record<string, string>): Promise<AxiosResponse<GraphQlQueryResponse<T>>> {
		const response = await this.axios.post<GraphQlQueryResponse<T>>(this.graphqlUrl,
			{
				query,
				variables
			},
			Object.assign({}, {
				...config,
				metrics
			}));

		const graphqlErrors = response.data?.errors;
		if (graphqlErrors?.length) {
			const err = new GithubClientGraphQLError(response, graphqlErrors);
			this.logger.warn({ err }, "GraphQL errors");

			// Please keep in sync with REST error mappings!!!!
			// TODO: consider moving both into some single error mapper to keep them close and avoid being not in sync

			if (graphqlErrors.find(graphQLError => graphQLError.type == "RATE_LIMITED")) {
				this.logger.info({ err }, "Mapping GraphQL errors to a rate-limiting error");
				return Promise.reject(new GithubClientRateLimitingError(buildAxiosStubErrorForGraphQlErrors(response)));

			} else if (graphqlErrors.find(graphqlError => graphqlError.type === "FORBIDDEN" && graphqlError.message === "Resource not accessible by integration")) {
				this.logger.info({ err }, "Mapping GraphQL errors to a InvalidPermission error");
				return Promise.reject(new GithubClientInvalidPermissionsError(buildAxiosStubErrorForGraphQlErrors(response)));

			} else if (graphqlErrors.find(graphqlError => graphqlError.type === "FORBIDDEN" && graphqlError.message === "has an IP allow list enabled")) {
				this.logger.info({ err }, "Mapping GraphQL errors to a BlockedIpError error");
				return Promise.reject(new GithubClientBlockedIpError(buildAxiosStubErrorForGraphQlErrors(response)));

			} else if (graphqlErrors.find(graphqlError => graphqlError.type === "FORBIDDEN" && response.headers?.["x-github-sso"])) {
				this.logger.info({ err }, "Mapping GraphQL errors to a SSOLoginError error");
				return Promise.reject(new GithubClientSSOLoginError(buildAxiosStubErrorForGraphQlErrors(response)));

			} else if (graphqlErrors.find(graphQLError => graphQLError.type == "NOT_FOUND")) {
				this.logger.info({ err }, "Mapping GraphQL error to not found");
				return Promise.reject(new GithubClientNotFoundError(buildAxiosStubErrorForGraphQlErrors(response)));
			}
			return Promise.reject(err);
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
}
