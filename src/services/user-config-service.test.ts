/* eslint-disable @typescript-eslint/no-explicit-any */
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { updateRepoConfig } from "services/user-config-service";
import { getInstallationId } from "~/src/github/client/installation-id";
import { envVars } from "config/env";

describe("User Config Service", () => {
	const gitHubInstallationId = 1234;
	let repoSyncState: RepoSyncState;
	let subscription: Subscription;

	const configFileContent = "deployments:\n" +
		"  environmentMapping:\n" +
		"    development:\n" +
		"      - \"dev*\"\n" +
		"      - \"Entwicklung\"\n" +
		"      - \"desenvolvimento\"\n" +
		"      - \"дев\"\n" +
		"    staging:\n" +
		"      - \"Pre-Prod\"\n" +
		"      - \"STG-*\"\n" +
		"      - \"staging\"\n" +
		"    production:\n" +
		"      - \"Produktion\"\n" +
		"      - \"produção\"\n" +
		"      - \"продакшн\"\n" +
		"      - \"PROD-*\"";

	const configFileContentBase64 = Buffer.from(configFileContent).toString("base64");


	beforeEach(async () => {
		subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: "client-key"
		});

		envVars.PROXY = undefined;

		repoSyncState = await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira",
			branchStatus: "complete",
			branchCursor: "foo",
			commitStatus: "complete",
			commitCursor: "bar",
			pullStatus: "complete",
			pullCursor: "12",
			buildStatus: "complete",
			buildCursor: "bang",
			deploymentStatus: "complete",
			deploymentCursor: "buzz",
			repoUpdatedAt: new Date(0)
		});

	});

	const givenGitHubReturnsConfigFile = () => {
		// see https://docs.github.com/en/rest/repos/contents#get-repository-content
		githubNock.get(`/repos/${repoSyncState.repoOwner}/${repoSyncState.repoName}/contents/.jira/config.yml`)
			.reply(200, {
				content: configFileContentBase64
			});
	};

	it("should not update config in database when config file hasn't been touched", async () => {
		await updateRepoConfig(subscription, repoSyncState.repoId, getInstallationId(gitHubInstallationId), ["random.yml", "ignored.yml"]);
		const freshRepoSyncState = await RepoSyncState.findByRepoId(subscription, repoSyncState.repoId);
		expect(freshRepoSyncState.config).toBeFalsy();
	});

	it("should update config in database when config file has been touched", async () => {
		githubUserTokenNock(gitHubInstallationId);
		givenGitHubReturnsConfigFile();
		await updateRepoConfig(subscription, repoSyncState.repoId, getInstallationId(gitHubInstallationId), ["random.yml", "ignored.yml", ".jira/config.yml"]);
		const freshRepoSyncState = await RepoSyncState.findByRepoId(subscription, repoSyncState.repoId);
		expect(freshRepoSyncState.config).toBeTruthy();
		expect(freshRepoSyncState.config?.deployments?.environmentMapping?.development).toHaveLength(4);
	});

});
