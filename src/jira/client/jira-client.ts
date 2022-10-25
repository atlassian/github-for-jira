import Logger from "bunyan";
import { getLogger } from "config/logger";
import { getCloudOrServerFromGitHubAppId, GithubProductEnum } from "utils/get-cloud-or-server";
import { Installation } from "models/installation";
import { getAxiosInstance } from "~/src/jira/client/axios";
import { AxiosInstance, AxiosResponse } from "axios";
import { JiraIssue, JiraIssueComments } from "interfaces/jira";

export class JiraClient {
	private readonly axios: AxiosInstance;
	private readonly logger: Logger;
	private readonly gitHubProduct: GithubProductEnum;
	private readonly gitHubInstallationId: number;
	private readonly gitHubAppId?: number;
	private readonly installation: Installation;

	public get jiraHost() {
		return this.installation.jiraHost;
	}

	constructor(installation: Installation, axios: AxiosInstance, gitHubInstallationId: number, gitHubProduct: GithubProductEnum, logger: Logger, gitHubAppId?: number) {
		this.installation = installation;
		this.gitHubProduct = gitHubProduct;
		this.gitHubInstallationId = gitHubInstallationId;
		this.gitHubAppId = gitHubAppId;
		this.logger = logger;
		this.axios = axios;
	}

	static async create(jiraHost: string, gitHubInstallationId: number, gitHubAppId?: number, log: Logger = getLogger("jira-client")): Promise<JiraClient> {
		const gitHubProduct = getCloudOrServerFromGitHubAppId(gitHubAppId);
		const logger = log.child({ jiraHost, gitHubInstallationId, gitHubProduct });
		const installation = await Installation.getForHost(jiraHost);

		if (!installation) {
			const msg = "Cannot initialize Jira Client, Installation doesn't exist.";
			logger.warn(msg);
			throw new Error(msg);
		}

		const axiosInstance = getAxiosInstance(
			installation.jiraHost,
			await installation.decrypt("encryptedSharedSecret"),
			logger
		);

		return new JiraClient(installation, axiosInstance, gitHubInstallationId, gitHubProduct, logger, gitHubAppId);
	}

	public async getIssue(issueId: string, query = { fields: "summary" }): Promise<AxiosResponse<JiraIssue>> {
		return await this.axios.get("/rest/api/latest/issue/{issue_id}", {
			params: query,
			urlParams: {
				issue_id: issueId
			}
		});
	}

	public async getAllIssues(issueIds: string[], query?: { fields: string }): Promise<JiraIssue[]> {
		const responses = await Promise.all<AxiosResponse<JiraIssue> | undefined>(
			issueIds.map((issueId) => this.getIssue(issueId, query)
				// Ignore any errors
				.catch(() => undefined)
			));
		return responses
			.filter((response) => response?.status === 200 && !!response?.data)
			.map(response => response!.data);
	}

	public async getIssueComments(issueIdOrKey: string):Promise<AxiosResponse<JiraIssueComments>> {
		return this.axios.get("/rest/api/latest/issue/{issueIdOrKey}/comment?expand=properties", {
			urlParams: {
				issueIdOrKey
			}
		});
	}
}
