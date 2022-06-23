import { Request, Response } from "express";
import { envVars }  from "config/env";
import { EnvironmentEnum } from "interfaces/common";

const instance = envVars.INSTANCE_NAME;
const isProd = (instance === EnvironmentEnum.production);
// TODO: implement named routes (https://www.npmjs.com/package/named-routes) to facilitate rerouting between files
export const postInstallUrl = "/jira/configuration";

const key = `com.github.integration${instance ? `.${instance}` : ""}`;
const conditions = [
	{
		condition: "user_is_admin"
	}
];

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
		modules: {
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
				conditions
			},
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
					conditions,
					name: {
						value: "GitHub for Jira"
					},
					key: "gh-addon-admin",
					location: "admin_plugins_menu/gh-addon-admin-section"
				}
			]
		}
	});
};
