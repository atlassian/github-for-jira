import { Request, Response } from "express";
import { envVars } from "config/env";
import { EnvironmentEnum } from "interfaces/common";
import { compact, map } from "lodash";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

const instance = envVars.INSTANCE_NAME;

const isProd = (instance === EnvironmentEnum.production);
// TODO: implement named routes (https://www.npmjs.com/package/named-routes) to facilitate rerouting between files
export const postInstallUrl = "/jira";
const key = `com.github.integration${instance ? `.${instance}` : ""}`;

const adminCondition = [
	{
		condition: "user_is_admin"
	}
];
const modules = {
	jiraDevelopmentTool: {
		application: {
			value: "GitHub"
		},
		capabilities: [
			"branch",
			"commit",
			"pull_request"
		],
		key: "github-development-tool",
		logoUrl: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
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
		logoUrl: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
		homeUrl: "https://github.com/features/actions"
	},
	jiraBuildInfoProvider: {
		key: "github-actions",
		logoUrl: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
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
		logoUrl: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
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
			key: "create-branch-options",
			name: {
				value: "GitHub Create Branch"
			},
			url: `/create-branch-options?issueKey={ac.issueKey}&issueSummary={ac.issueSummary}`,
			location: "none"
		},
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
			url: "/jira/connect/enterprise/{ac.serverUrl}/app?new={ac.new}",
			location: "none",
			conditions: adminCondition
		},
		{
			key: "github-list-server-apps-page",
			name: {
				value: "GitHub Server Apps"
			},
			url: "/jira/connect/enterprise/{ac.serverUrl}/app",
			location: "none",
			conditions: adminCondition
		},
		{
			key: "github-manual-app-page",
			name: {
				value: "GitHub Manual App"
			},
			url: "/jira/connect/enterprise/{ac.serverUrl}/app/new",
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
		}
	],
	webSections: [
		{
			key: "gh-addon-admin-section",
			location: "admin_plugins_menu",
			name: {
				value: "GitHub"
			}
		}
	],
	adminPages: [
		{
			url: postInstallUrl,
			conditions: adminCondition,
			name: {
				value: "GitHub for Jira"
			},
			key: "gh-addon-admin",
			location: "admin_plugins_menu/gh-addon-admin-section"
		}, {
			url: "/jira/configuration",
			conditions: adminCondition,
			name: {
				value: "GitHub for Jira"
			},
			key: "gh-addon-admin-old",
			location: "none"
		}
	]
};

export const moduleUrls = compact(map([...modules.adminPages, ...modules.generalPages], "url"));

// Remove this function when CREATE_BRANCH flag is complete
const addCreateBranchAction = async (modules) => {
	if (await booleanFlag(BooleanFlags.CREATE_BRANCH, true)) {
		modules.jiraDevelopmentTool.actions = {
			createBranch: {
				templateUrl: `/plugins/servlet/ac/${key}/create-branch-options?ac.issueKey={issue.key}&ac.issueSummary={issue.summary}`
			}
		};
	}
	return modules;
};

export const JiraAtlassianConnectGet = async (_: Request, res: Response): Promise<void> => {
	res.status(200).json({
		// Will need to be set to `true` once we verify the app will work with
		// GDPR compliant APIs. Ref: https://github.com/github/ce-extensibility/issues/220
		apiMigrations: {
			gdpr: false,
			"signed-install": true
		},
		// TODO: allow for more flexibility of naming
		name: `GitHub for Jira${isProd ? "" : (instance ? (` (${instance})`) : "")}`,
		description: "Connect your code and your project with ease.",
		key,
		baseUrl: envVars.APP_URL,
		lifecycle: {
			installed: "/jira/events/installed",
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
		modules: await addCreateBranchAction(modules)
	});
};
