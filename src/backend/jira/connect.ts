import { Request, Response } from "express";
import envVars, { EnvironmentEnum } from "../../config/env";

const instance = process.env.INSTANCE_NAME;
const isProd = (instance === EnvironmentEnum.production);

export default (_: Request, res: Response): void => {
	const appKey = `com.github.integration${instance ? `.${instance}` : ""}`;

	const adminPageDisplayConditions = [
		{
			condition: "user_is_admin"
		}
	];

	res.status(200)
		.json({
			// Will need to be set to `true` once we verify the app will work with
			// GDPR compliant APIs. Ref: https://github.com/github/ce-extensibility/issues/220
			apiMigrations: {
				gdpr: false
			},
			// TODO: allow for more flexibility of naming
			name: `GitHub for Jira${isProd ? "" : (instance ? (` (${instance})`) : "")}`,
			description: "Connect your code and your project with ease.",
			key: appKey,
			baseUrl: envVars.APP_URL,
			lifecycle: {
				installed: "/jira/events/installed",
				uninstalled: "/jira/events/uninstalled",
				enabled: "/jira/events/enabled",
				disabled: "/jira/events/disabled"
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
						value: "GitHub Actions",
					},
					logoUrl: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
					homeUrl: "https://github.com/features/actions",
				},
				jiraBuildInfoProvider: {
					key: "github-actions",
					logoUrl: "https://github.githubassets.com/images/modules/logos_page/GitHub-Mark.png",
					name: {
						value: "GitHub Actions",
					},
					homeUrl: "https://github.com/features/actions",
				},
				postInstallPage: {
					key: "github-post-install-page",
					name: {
						value: "GitHub Configuration"
					},
					url: "/jira/configuration",
					conditions: adminPageDisplayConditions
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
						url: "/jira/configuration",
						conditions: adminPageDisplayConditions,
						name: {
							value: "Configure integration"
						},
						key: "gh-addon-admin",
						location: "admin_plugins_menu/gh-addon-admin-section"
					}
				]
			}
		});
};
