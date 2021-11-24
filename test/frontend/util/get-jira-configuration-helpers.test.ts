/* eslint-disable @typescript-eslint/no-var-requires */
import { getFailedConnections, getInstallation } from "../../../src/frontend/get-jira-configuration";
import { GitHubAPI } from "probot";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "../../../src/config/feature-flags";
import { RepoSyncState, Subscription } from "../../../src/models";
import SubscriptionClass from "../../../src/models/subscription";

jest.mock("../../../src/config/feature-flags");

describe("getFailedConnections", () => {
	const noSubscriptions = require("../../fixtures/get-jira-configuration/no-subscriptions");
	const singleSubscription = require("../../fixtures/get-jira-configuration/single-subscription");
	const multipleSubscriptions = require("../../fixtures/get-jira-configuration/multiple-subscriptions");
	const subscriptionWithNoRepos = require("../../fixtures/get-jira-configuration/subscription-with-no-repos");

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
		const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation");
		const result = await getFailedConnections(singleFailedInstallation, singleSubscription);
		expect(result).toHaveLength(1);
		expect(result).toEqual([{ deleted: true, id: 12345678, orgName: "fake-name" }]);
	});

	it("should return a single failed connection if 1 connection fails and 1 succeeds", async () => {
		const singleFailedAndSingleSuccessdulInstallation = require("../../fixtures/get-jira-configuration/single-successful-and-single-failed-installations");
		const result = await getFailedConnections(singleFailedAndSingleSuccessdulInstallation, singleSubscription);
		expect(result).toHaveLength(1);
		expect(result).toEqual([{ deleted: true, id: 12345678, orgName: "fake-name" }]);
	});

	it("should return a multiple failed connections if there is more than 1 failed connection", async () => {
		const multipleFailedInstallations = require("../../fixtures/get-jira-configuration/multiple-failed-installations");
		const result = await getFailedConnections(multipleFailedInstallations, multipleSubscriptions);
		expect(result).toHaveLength(2);
		expect(result).toEqual([
			{ deleted: true, id: 12345678, orgName: "fake-name" },
			{ deleted: true, id: 23456789, orgName: "fake-name-two" }
		]);
	});

	it("should return a multiple failed connections if there are multiple successful and failed connections", async () => {
		const multipleFailedAndSuccessfulInstallations = require("../../fixtures/get-jira-configuration/muliple-successful-and-multiple-failed-installations");
		const result = await getFailedConnections(multipleFailedAndSuccessfulInstallations, multipleSubscriptions);
		expect(result).toHaveLength(2);
		expect(result).toEqual([
			{ deleted: true, id: 12345678, orgName: "fake-name" },
			{ deleted: true, id: 23456789, orgName: "fake-name-two" }
		]);
	});

	it("should return 'undefined' for the orgName of subscriptions with no repos", async () => {
		const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation");
		const result = await getFailedConnections(singleFailedInstallation, subscriptionWithNoRepos);
		expect(result).toHaveLength(1);
		expect(result).toEqual([{ deleted: true, id: 12345678, orgName: undefined }]);
	});

	describe("RepoSyncState table", () => {
		afterEach(async () => {
			await RepoSyncState.destroy({ truncate: true });
		});

		it("should return failed connections from new RepoSyncState table", async () => {
			const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation");

			when(booleanFlag).calledWith(
				BooleanFlags.REPO_SYNC_STATE_AS_SOURCE,
				expect.anything(),
				expect.anything()
			).mockResolvedValue(true);

			await RepoSyncState.create({
				subscriptionId: 12345678,
				repoId: 1,
				repoName: "github-for-jira",
				repoOwner: "atlassian",
				repoFullName: "atlassian/github-for-jira",
				repoUrl: "github.com/atlassian/github-for-jira",
				repoUpdatedAt: new Date(0)
			});
			const result = await getFailedConnections(singleFailedInstallation, singleSubscription);
			expect(result).toHaveLength(1);
			expect(result).toEqual([{ deleted: true, id: 12345678, orgName: "atlassian" }]);
		});
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
			// subscriptionUpdatedAt: new Date(0), // Not testing this as it's using moment
			totalNumberOfRepos: 2,
			numberOfSyncedRepos: 1,
			jiraHost
		};

		subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			syncStatus: "ACTIVE",
			repoSyncState: {
				installationId: gitHubInstallationId,
				jiraHost,
				numberOfSyncedRepos: 1,
				repos: {
					"1": {
						pullStatus: "complete",
						branchStatus: "complete",
						commitStatus: "complete",
						lastBranchCursor: "foo",
						lastCommitCursor: "bar",
						lastPullCursor: 12,
						repository: {
							id: "1",
							name: "github-for-jira",
							full_name: "atlassian/github-for-jira",
							html_url: "github.com/atlassian/github-for-jira",
							owner: {
								login: "atlassian"
							},
							updated_at: new Date(0)
						}
					},
					"2": {
						branchStatus: "failed",
						repository: {
							id: "2",
							name: "github-for-jira",
							full_name: "atlassian/github-for-jira",
							html_url: "github.com/atlassian/github-for-jira",
							owner: {
								login: "atlassian"
							},
							updated_at: new Date(0)
						}
					}
				}
			}
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

	it("Should get installation from repoSyncState", async () => {
		const result = await getInstallation(GitHubAPI(), subscription);
		expect(result).toMatchObject(match);
	});

	it("Should get installation from Repo Sync State table", async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.REPO_SYNC_STATE_AS_SOURCE,
			expect.anything()
		).mockResolvedValue(true);

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
			pullCursor: "12",
			repoUpdatedAt: new Date(0)
		});

		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "github-for-jira",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira",
			branchStatus: "failed",
			repoUpdatedAt: new Date(0)
		});

		const result = await getInstallation(GitHubAPI(), subscription);
		expect(result).toMatchObject(match);
	});
});

