/* eslint-disable @typescript-eslint/no-explicit-any */
import { RepoSyncState } from "models/reposyncstate";
import { Subscription } from "models/subscription";
import { getRepoConfig, updateRepoConfig } from "services/user-config-service";
import { createInstallationClient } from "utils/get-github-client-config";
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "../github/client/github-installation-client";

const logger = getLogger("test");

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
		"      - \"PROD-*\"\n" +
		"  services:\n" +
		"    ids:\n" +
		"      - \"test-id-1\"\n" +
		"      - \"test-id-2\"\n" +
		"      - \"test-id-3\"\n" +
		"      - \"test-id-4\"";

	let gitHubClient: GitHubInstallationClient;

	beforeEach(async () => {
		subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: "client-key"
		});

		process.env.PROXY = undefined;

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

		gitHubClient = await createInstallationClient(gitHubInstallationId, jiraHost, { trigger: "test", subTrigger: "test" }, logger, undefined);

	});

	const givenGitHubReturnsConfigFile = ({
		repoOwner = repoSyncState.repoOwner,
		repoName = repoSyncState.repoName,
		fileContent = configFileContent
	}: { repoOwner?: string, repoName?: string, fileContent?: string } = {}) => {
		// see https://docs.github.com/en/rest/repos/contents#get-repository-content
		githubNock.get(`/repos/${repoOwner}/${repoName}/contents/.jira/config.yml`)
			.reply(200, {
				content: Buffer.from(fileContent).toString("base64")
			});
	};

	const givenGitHubReturnsAccessNotAllowed = (repoOwner: string = repoSyncState.repoOwner, repoName = repoSyncState.repoName) => {
		// see https://docs.github.com/en/rest/repos/contents#get-repository-content
		githubNock.get(`/repos/${repoOwner}/${repoName}/contents/.jira/config.yml`)
			.reply(401, {
				content: "not allowed"
			});
	};

	it("should not update config in database when config file hasn't been touched", async () => {
		await updateRepoConfig(subscription, repoSyncState.repoId, gitHubClient, logger, ["random.yml", "ignored.yml"]);
		const config = await getRepoConfig(subscription, gitHubClient, repoSyncState.repoId, repoSyncState.repoOwner, repoSyncState.repoName, logger);
		expect(config).toBeFalsy();
	});

	it("should update config in database when config file has been touched", async () => {
		githubUserTokenNock(gitHubInstallationId);
		givenGitHubReturnsConfigFile();
		await updateRepoConfig(subscription, repoSyncState.repoId, gitHubClient, logger, ["random.yml", "ignored.yml", ".jira/config.yml"]);
		const config = await getRepoConfig(subscription, gitHubClient, repoSyncState.repoId, repoSyncState.repoOwner, repoSyncState.repoName, logger);
		expect(config).toBeTruthy();
		expect(config?.deployments?.environmentMapping?.development).toHaveLength(4);
	});

	it("no Write perms case should be tolerated", async () => {
		githubUserTokenNock(gitHubInstallationId);
		givenGitHubReturnsAccessNotAllowed();
		await updateRepoConfig(subscription, repoSyncState.repoId, gitHubClient, logger, ["random.yml", "ignored.yml", ".jira/config.yml"]);
		const config = await getRepoConfig(subscription, gitHubClient, repoSyncState.repoId, repoSyncState.repoOwner, repoSyncState.repoName, logger);
		expect(config).toBeFalsy();
	});

	it("should get service ids", async () => {
		githubUserTokenNock(gitHubInstallationId);
		givenGitHubReturnsConfigFile();
		await updateRepoConfig(subscription, repoSyncState.repoId, gitHubClient, logger, ["random.yml", "ignored.yml", ".jira/config.yml"]);
		const config = await getRepoConfig(subscription, gitHubClient, repoSyncState.repoId, repoSyncState.repoOwner, repoSyncState.repoName, logger);
		expect(config).toBeTruthy();
		expect(config?.deployments?.services?.ids).toHaveLength(4);
	});

	it("should get config directly from GitHub when we don't have a record of the repo", async () => {
		// coordinates of a repo that we don't have in the database
		const unknownRepoName = "unknownRepo";
		const unknownRepoOwner = "unknownOwner";
		const unknownRepoId = 42;

		githubUserTokenNock(gitHubInstallationId);
		givenGitHubReturnsConfigFile({ repoOwner: unknownRepoOwner, repoName: unknownRepoName });

		const config = await getRepoConfig(subscription, gitHubClient, unknownRepoId, unknownRepoOwner, unknownRepoName, logger);

		expect(config).toBeTruthy();
		expect(config?.deployments?.environmentMapping?.development).toHaveLength(4);
	});

	it("should maintain environment order for top-down matching", async () => {
		const fileContent = "deployments:\n" +
			"  environmentMapping:\n" +
			"    development: [\"DEV-*\"]\n" +
			"    staging: [\"STG-*\"]\n" +
			"    production: [\"PRD-*\"]\n" +
			"    testing: [\"*\"]\n";

		githubUserTokenNock(gitHubInstallationId);
		givenGitHubReturnsConfigFile({ fileContent });
		await updateRepoConfig(subscription, repoSyncState.repoId, gitHubClient, logger, ["random.yml", "ignored.yml", ".jira/config.yml"]);
		const config = await getRepoConfig(subscription, gitHubClient, repoSyncState.repoId, repoSyncState.repoOwner, repoSyncState.repoName, logger);
		expect(Object.keys(config?.deployments?.environmentMapping ?? {})).toStrictEqual(["development", "staging", "production", "testing"]);
	});
});
