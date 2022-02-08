/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { RepoSyncState, Subscription } from "../../../src/models";
import SubscriptionClass from "../../../src/models/subscription";
import { getInstallations } from "../../../src/routes/jira/configuration/get-jira-configuration";
import GithubApi from "../../../src/config/github-api";
import { GitHubAPI } from "probot";


describe("getInstallations", () => {
	let sub: SubscriptionClass;
	const client = GithubApi();

	beforeEach(async () => {
		sub = await Subscription.create({
			gitHubInstallationId: 12345678,
			jiraHost,
			jiraClientKey: "myClientKey"
		});
	});

	it("should return no success or failed connections if no subscriptions given", async () => {
		expect(await getInstallations(client, [])).toEqual({
			fulfilled: [],
			rejected: [],
			total: 0
		});
	});

	it("should return successful connections when installation exists", async () => {
		githubNock
			.get(`/app/installations/${sub.gitHubInstallationId}`)
			.reply(200, require("../../fixtures/get-jira-configuration/single-installation.json"));

		expect(await getInstallations(GitHubAPI(), [sub])).toMatchObject({
			fulfilled: [{
				id: sub.gitHubInstallationId,
				syncStatus: null,
				syncWarning: null,
				totalNumberOfRepos: 0,
				numberOfSyncedRepos: 0,
				jiraHost
			}],
			rejected: []
		});
	});

	it("should return a single failed connection if 1 connection fails", async () => {
		githubNock
			.get(`/app/installations/${sub.gitHubInstallationId}`)
			.reply(404, require("../../fixtures/get-jira-configuration/failed-installation.json"));

		expect(await getInstallations(GitHubAPI(), [sub])).toMatchObject({
			fulfilled: [],
			rejected: [{
				error: {
					status: 404,
					documentation_url: "https://docs.github.com/rest/reference/apps#get-an-installation-for-the-authenticated-app"
				},
				id: sub.gitHubInstallationId,
				deleted: true
			}]
		});
	});

	it("should return one successful connection if installation exists and one failed one if installation doesn't exist", async () => {
		const failedSub: SubscriptionClass = await Subscription.create({
			gitHubInstallationId: 123,
			jiraHost,
			jiraClientKey: "myClientKey"
		});

		githubNock
			.get(`/app/installations/${sub.gitHubInstallationId}`)
			.reply(200, require("../../fixtures/get-jira-configuration/single-installation.json"));

		githubNock
			.get(`/app/installations/${failedSub.gitHubInstallationId}`)
			.reply(404, require("../../fixtures/get-jira-configuration/failed-installation.json"));

		expect(await getInstallations(GitHubAPI(), [sub, failedSub])).toMatchObject({
			fulfilled: [{
				id: sub.gitHubInstallationId,
				syncStatus: null,
				syncWarning: null,
				totalNumberOfRepos: 0,
				numberOfSyncedRepos: 0,
				jiraHost
			}],
			rejected: [{
				error: {
					status: 404,
					documentation_url: "https://docs.github.com/rest/reference/apps#get-an-installation-for-the-authenticated-app"
				},
				id: failedSub.gitHubInstallationId,
				deleted: true
			}]
		});
	});

	it("should return a multiple failed connections if no installations exists", async () => {
		const failedSub: SubscriptionClass = await Subscription.create({
			gitHubInstallationId: 123,
			jiraHost,
			jiraClientKey: "myClientKey"
		});

		githubNock
			.get(`/app/installations/${sub.gitHubInstallationId}`)
			.reply(404, require("../../fixtures/get-jira-configuration/failed-installation.json"));

		githubNock
			.get(`/app/installations/${failedSub.gitHubInstallationId}`)
			.reply(404, require("../../fixtures/get-jira-configuration/failed-installation.json"));

		expect(await getInstallations(GitHubAPI(), [sub, failedSub])).toMatchObject({
			fulfilled: [],
			rejected: [
				{
					error: {
						status: 404,
						documentation_url: "https://docs.github.com/rest/reference/apps#get-an-installation-for-the-authenticated-app"
					},
					id: sub.gitHubInstallationId,
					deleted: true
				},
				{
					error: {
						status: 404,
						documentation_url: "https://docs.github.com/rest/reference/apps#get-an-installation-for-the-authenticated-app"
					},
					id: failedSub.gitHubInstallationId,
					deleted: true
				}
			]
		});
	});

	it("should return successful connection with correct number of repos and sync status", async () => {
		await RepoSyncState.create({
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira",
			pullStatus: "complete",
			commitStatus: "complete",
			branchStatus: "complete"
		});

		await RepoSyncState.create({
			subscriptionId: sub.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira",
			pullStatus: "pending",
			commitStatus: "complete",
			branchStatus: "complete"
		});

		githubNock
			.get(`/app/installations/${sub.gitHubInstallationId}`)
			.reply(200, require("../../fixtures/get-jira-configuration/single-installation.json"));

		expect(await getInstallations(GitHubAPI(), [sub])).toMatchObject({
			fulfilled: [{
				id: sub.gitHubInstallationId,
				syncStatus: null,
				syncWarning: null,
				totalNumberOfRepos: 2,
				numberOfSyncedRepos: 1,
				jiraHost
			}],
			rejected: []
		});
	});
});
