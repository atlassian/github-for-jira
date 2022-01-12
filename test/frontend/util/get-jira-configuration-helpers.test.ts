/* eslint-disable @typescript-eslint/no-var-requires */
import { getFailedConnections, getInstallation } from "../../../src/frontend/get-jira-configuration";
import { GitHubAPI } from "probot";
import { RepoSyncState, Subscription } from "../../../src/models";
import SubscriptionClass from "../../../src/models/subscription";

describe("getFailedConnections", () => {
	const noSubscriptions = require("../../fixtures/get-jira-configuration/no-subscriptions.json");
	const singleSubscription = require("../../fixtures/get-jira-configuration/single-subscription.json");
	const multipleSubscriptions = require("../../fixtures/get-jira-configuration/multiple-subscriptions.json");
	const subscriptionWithNoRepos = require("../../fixtures/get-jira-configuration/subscription-with-no-repos.json");

	beforeEach(async () => {
		await RepoSyncState.create({
			subscriptionId: 12345678,
			repoId: 1,
			repoName: "test-repo-name",
			repoOwner: "integrations",
			repoFullName: "integrations/test-repo-name",
			repoUrl: "test-repo-url",
		});
	});

	afterEach(async () => {
		await RepoSyncState.destroy({ truncate: true });
	});

	it("should return no failed connections if there are no installations", async () => {
		const noInstallations = require("../../fixtures/get-jira-configuration/no-installations");
		const result = await getFailedConnections(noInstallations, noSubscriptions);
		expect(result).toHaveLength(0);
		expect(result).toEqual([]);
	});

	it("should return no failed connections if no connections fail", async () => {
		const singleSuccessfulInstallation = require("../../fixtures/get-jira-configuration/single-successful-installation");
		const result = await getFailedConnections(singleSuccessfulInstallation, singleSubscription);
		expect(result).toHaveLength(0);
		expect(result).toEqual([]);
	});

	it("should return a single failed connection if 1 connection fails", async () => {
		const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation.json");
		const result = await getFailedConnections(singleFailedInstallation, singleSubscription);
		expect(result).toHaveLength(1);
		expect(result).toEqual([{ deleted: true, id: 12345678, orgName: "integrations" }]);
	});

	it("should return a single failed connection if 1 connection fails and 1 succeeds", async () => {
		const singleFailedAndSingleSuccessdulInstallation = require("../../fixtures/get-jira-configuration/single-successful-and-single-failed-installations");
		const result = await getFailedConnections(singleFailedAndSingleSuccessdulInstallation, singleSubscription);
		expect(result).toHaveLength(1);
		expect(result).toEqual([{ deleted: true, id: 12345678, orgName: "integrations" }]);
	});

	it("should return a multiple failed connections if there is more than 1 failed connection", async () => {
		const multipleFailedInstallations = require("../../fixtures/get-jira-configuration/multiple-failed-installations");
		await RepoSyncState.create({
			subscriptionId: 23456789,
			repoId: 2,
			repoName: "test-repo-name",
			repoOwner: "integrations2",
			repoFullName: "integrations/test-repo-name",
			repoUrl: "test-repo-url",
		});
		const result = await getFailedConnections(multipleFailedInstallations, multipleSubscriptions);
		expect(result).toHaveLength(2);
		expect(result).toEqual([
			{ deleted: true, id: 12345678, orgName: "integrations" },
			{ deleted: true, id: 23456789, orgName: "integrations2" }
		]);
	});

	it("should return a multiple failed connections if there are multiple successful and failed connections", async () => {
		const multipleFailedAndSuccessfulInstallations = require("../../fixtures/get-jira-configuration/muliple-successful-and-multiple-failed-installations");

		await RepoSyncState.create({
			subscriptionId: 23456789,
			repoId: 2,
			repoName: "test-repo-name",
			repoOwner: "integrations2",
			repoFullName: "integrations/test-repo-name",
			repoUrl: "test-repo-url",
		});
		const result = await getFailedConnections(multipleFailedAndSuccessfulInstallations, multipleSubscriptions);
		expect(result).toHaveLength(2);
		expect(result).toEqual([
			{ deleted: true, id: 12345678, orgName: "integrations" },
			{ deleted: true, id: 23456789, orgName: "integrations2" }
		]);
	});

	it("should return 'undefined' for the orgName of subscriptions with no repos", async () => {
		const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation");
		const result = await getFailedConnections(singleFailedInstallation, subscriptionWithNoRepos);
		expect(result).toHaveLength(1);
		expect(result).toEqual([{ deleted: true, id: 12345678, orgName: undefined }]);
	});
});

describe("getInstallation", () => {
	let subscription: SubscriptionClass;
	const gitHubInstallationId = 1234;
	let match;

	beforeEach(async () => {
		match = {
			syncStatus: "IN PROGRESS",
			syncWarning: null,
			totalNumberOfRepos: 2,
			numberOfSyncedRepos: 1,
			jiraHost
		};

		subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			syncStatus: "ACTIVE"
		});

		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira",
			pullStatus: "complete",
			branchStatus: "complete",
			commitStatus: "complete",
			branchCursor: "foo",
			commitCursor: "bar",
			pullCursor: "blarg"
		});

		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 2,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira",
			branchStatus: "failed"
		});

		githubNock
			.get(`/app/installations/${gitHubInstallationId}`)
			.reply(200, {
				"id": gitHubInstallationId,
				"account": {
					"login": "atlassian",
					"id": 1,
					"node_id": "MDQ6VXNlcjE=",
					"avatar_url": "https://github.com/images/error/octocat_happy.gif",
					"url": "https://api.github.com/users/octocat",
					"html_url": "https://github.com/octocat",
					"type": "User",
					"site_admin": false
				},
				"html_url": "https://github.com/organizations/github/settings/installations/1",
				"app_id": 1,
				"target_id": 1,
				"target_type": "Organization"
			});
	});

	afterEach(async () => {
		await Subscription.destroy({ truncate: true });
		await RepoSyncState.destroy({ truncate: true });
	});

	it("Should get installation from Repo Sync State table", async () => {
		const result = await getInstallation(GitHubAPI(), subscription);
		expect(result).toMatchObject(match);
	});
});

