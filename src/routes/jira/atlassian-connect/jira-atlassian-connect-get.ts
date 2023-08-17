import { Request, Response } from "express";
import { envVars } from "config/env";
import { compact, map } from "lodash";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

const instance = envVars.APP_KEY.split(".").pop();
const isProd = instance === "production";

// TODO: implement named routes (https://www.npmjs.com/package/named-routes) to facilitate rerouting between files
export const postInstallUrl = "/jira";
export const APP_NAME = `GitHub for Jira${isProd ? "" : ` (${instance})`}`;
export const LOGO_URL = "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png";

const adminCondition = [
	{
		condition: "user_is_admin"
	}
];

interface JiraDevelopmentToolActions {
	createBranch?: {
		templateUrl: string;
	};
	searchConnectedWorkspaces?: {
		templateUrl: string;
	};
	searchRepositories?: {
		templateUrl: string;
	};
	associateRepository?: {
		templateUrl: string;
	};
}

const CREATE_BRANCH_ENDPOINT =
	`${envVars.APP_URL}/create-branch-options?issueKey={issue.key}&issueSummary={issue.summary}&tenantUrl={tenant.url}&jwt={jwt}&addonkey=${envVars.APP_KEY}`;
const SEARCH_CONNECTED_WORKSPACES_ENDPOINT = `${envVars.APP_URL}/jira/workspaces/search`;
const SEARCH_REPOSITORIES_ENDPOINT = `${envVars.APP_URL}/jira/workspaces/repositories/search`;
const ASSOCIATE_REPOSITORY_ENDPOINT = `${envVars.APP_URL}/jira/workspaces/repositories/associate`;

export const getGenericContainerUrls = async (): Promise<string[]> => {
	return [
		SEARCH_CONNECTED_WORKSPACES_ENDPOINT,
		SEARCH_REPOSITORIES_ENDPOINT,
		ASSOCIATE_REPOSITORY_ENDPOINT
	];
};

export const defineJiraDevelopmentToolModuleActions = async (jiraHost: string): Promise<JiraDevelopmentToolActions> => {
	if (await booleanFlag(BooleanFlags.ENABLE_GENERIC_CONTAINERS, jiraHost)) {
		return {
			createBranch: {
				templateUrl: CREATE_BRANCH_ENDPOINT
			},
			searchConnectedWorkspaces: {
				templateUrl: SEARCH_CONNECTED_WORKSPACES_ENDPOINT
			},
			searchRepositories: {
				templateUrl: SEARCH_REPOSITORIES_ENDPOINT
			},
			associateRepository: {
				templateUrl: ASSOCIATE_REPOSITORY_ENDPOINT
			}
		};
	} else {
		return {
			createBranch: {
				templateUrl: CREATE_BRANCH_ENDPOINT
			}
		};
	}
};

const jiraSecurityInfoProvider = {
	homeUrl:  "https://github.com",
	logoUrl: LOGO_URL,
	documentationUrl: "https://docs.github.com/code-security",
	actions: {
		fetchContainers: {
			templateUrl: `${envVars.APP_URL}/jira/security/workspaces/containers`
		},
		fetchWorkspaces: {
			templateUrl: `${envVars.APP_URL}/jira/security/workspaces`
		},
		searchContainers: {
			templateUrl: `${envVars.APP_URL}/jira/security/workspaces/containers/search`
		}
	},
	"name": {
		"value": "GitHub Security"
	},
	"key": "github-security"
};

export const getSecurityContainerActionUrls = [
	jiraSecurityInfoProvider.actions.fetchContainers.templateUrl,
	jiraSecurityInfoProvider.actions.searchContainers.templateUrl,
	jiraSecurityInfoProvider.actions.fetchWorkspaces.templateUrl
];

const	modules = {
	jiraDevelopmentTool: {
		application: {
			value: "GitHub"
		},
		capabilities: [
			"branch",
			"commit",
			"pull_request"
		],
		actions: {} as JiraDevelopmentToolActions,
		key: "github-development-tool",
		logoUrl: LOGO_URL,
		name: {
			value: "GitHub"
		},
		url: "https://github.com"
	},
	jiraDeploymentInfoProvider: {
		key: "github-deployments",
		name: {
			value: "GitHub Actions"
		},
		logoUrl: LOGO_URL,
		homeUrl: "https://github.com/features/actions"
	},
	jiraBuildInfoProvider: {
		key: "github-actions",
		logoUrl: LOGO_URL,
		name: {
			value: "GitHub Actions"
		},
		homeUrl: "https://github.com/features/actions"
	},
	jiraRemoteLinkInfoProvider: {
		key: "github-remotelinks-integration",
		name: {
			value: "GitHub"
		},
		logoUrl: LOGO_URL,
		homeUrl: "https://github.com"
	},
	postInstallPage: {
		key: "github-post-install-page",
		name: {
			value: "GitHub Configuration"
		},
		url: postInstallUrl,
		conditions: adminCondition
	},
	generalPages: [
		{
			key: "github-select-product-page",
			name: {
				value: "GitHub Select Product"
			},
			url: "/jira/connect",
			location: "none",
			conditions: adminCondition
		},
		{
			key: "github-server-url-page",
			name: {
				value: "GitHub Server Url"
			},
			url: "/jira/connect/enterprise?new={ac.new}",
			location: "none",
			conditions: adminCondition
		},
		{
			key: "github-list-servers-page",
			name: {
				value: "GitHub Enterprise Servers"
			},
			url: "/jira/connect/enterprise",
			location: "none",
			conditions: adminCondition
		},
		{
			key: "github-app-creation-page",
			name: {
				value: "GitHub App Creation"
			},
			// connectConfigUuid might be either an existing app uuid or a key of one stored in Redis (see GheConnectConfigTempStorage)
			// Let's keep it vague and not differentiate to avoid brain melting
			url: "/jira/connect/enterprise/{ac.connectConfigUuid}/app?new={ac.new}",
			location: "none",
			conditions: adminCondition
		},
		{
			key: "github-list-server-apps-page",
			name: {
				value: "GitHub Server Apps"
			},
			// connectConfigUuid might be either an existing app uuid or a key of one stored in Redis (see GheConnectConfigTempStorage)
			// Let's keep it vague and not differentiate to avoid brain melting
			url: "/jira/connect/enterprise/{ac.connectConfigUuid}/app",
			location: "none",
			conditions: adminCondition
		},
		{
			key: "github-manual-app-page",
			name: {
				value: "GitHub Manual App"
			},
			// connectConfigUuid might be either an existing app uuid or a key of one stored in Redis (see GheConnectConfigTempStorage)
			// Let's keep it vague and not differentiate to avoid brain melting
			url: "/jira/connect/enterprise/{ac.connectConfigUuid}/app/new",
			location: "none",
			conditions: adminCondition
		},
		{
			key: "github-edit-app-page",
			name: {
				value: "GitHub Edit App"
			},
			url: "/jira/connect/enterprise/app/{ac.uuid}",
			location: "none",
			conditions: adminCondition
		},
		{
			key: "spa-index-page",
			name: {
				value: "GitHub for Jira SPA Index Page"
			},
			url: "/spa",
			location: "none",
			conditions: adminCondition
		}
	],
	webSections: [
		{
			key: "gh-addon-admin-section",
			location: "admin_plugins_menu",
			name: {
				value: APP_NAME
			}
		}
	],
	adminPages: [
		{
			url: postInstallUrl,
			conditions: adminCondition,
			name: {
				value: "Configure"
			},
			key: "gh-addon-admin",
			location: "admin_plugins_menu/gh-addon-admin-section"
		}, {
			url: "/jira/configuration",
			conditions: adminCondition,
			name: {
				value: "Configure"
			},
			key: "gh-addon-admin-old",
			location: "none"
		}
	]
};


export const JiraAtlassianConnectGet = async (_: Request, res: Response): Promise<void> => {
	const { jiraHost } =  res.locals;
	modules.jiraDevelopmentTool.actions = await defineJiraDevelopmentToolModuleActions(jiraHost);
	const isGitHubSecurityInJiraEnabled = await booleanFlag(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, jiraHost);

	res.status(200).json({
		apiMigrations: {
			gdpr: false,
			"signed-install": true
		},
		name: APP_NAME,
		description: "Connect your code and your project with ease.",
		key: envVars.APP_KEY,
		baseUrl: envVars.APP_URL,
		lifecycle: {
			installed: "/jira/events/installed",
			enabled: "/jira/events/enabled",
			disabled: "/jira/events/disabled",
			uninstalled: "/jira/events/uninstalled"
		},
		vendor: {
			name: "Atlassian",
			url: "https://atlassian.com"
		},
		authentication: {
			type: "jwt"
		},
		scopes: [
			"READ",
			"WRITE",
			"DELETE"
		],
		apiVersion: 1,
		modules: {
			...(isGitHubSecurityInJiraEnabled && { jiraSecurityInfoProvider }),
			...modules
		}
	});
};
const moduleUrls = compact(map([...modules.adminPages, ...modules.generalPages], "url"));
export { moduleUrls };
