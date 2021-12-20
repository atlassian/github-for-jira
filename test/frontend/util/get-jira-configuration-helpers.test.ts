/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { Subscription } from "../../../src/models";
import SubscriptionClass from "../../../src/models/subscription";
import { getInstallations } from "../../../src/frontend/get-jira-configuration";
// import { when } from "jest-when";
// import { booleanFlag, BooleanFlags } from "../../../src/config/feature-flags";
import GithubApi from "../../../src/config/github-api";

jest.mock("../../../src/config/feature-flags");

describe("getInstallations", () => {
	let sub: SubscriptionClass;
	beforeEach(async () => {
		sub = await Subscription.create({
			gitHubInstallationId: 12345678,
			jiraHost,
			jiraClientKey: "myClientKey",
			repoSyncState: { }
		});
	});
	const client = GithubApi();

	it("should return no failed connections if there are no installations", async () => {
		expect(await getInstallations(client, [])).toEqual({
			fulfilled: [],
			rejected: [],
			total: 0
		});
	});

	// TODO: need to fix up these test in the next PR
	it.skip("should return no failed connections if no connections fail", async () => {
		githubNock
			.get(`/app/installations/${sub.gitHubInstallationId}`)
			.reply(200, require("../../fixtures/get-jira-configuration/single-installation.json"));

		expect(await getInstallations({} as any, [sub])).toMatchObject({
			fulfilled: [{
				id: 12345678,
				syncStatus: undefined,
				syncWarning: undefined,
				totalNumberOfRepos: 0,
				numberOfSyncedRepos: 0,
				jiraHost
			}],
			rejected: []
		});
	});
	/*
		it("should return a single failed connection if 1 connection fails", async () => {
			const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation");
			expect(
				getFailedConnections(singleFailedInstallation, singleSubscription)
			).toHaveLength(1);
			expect(
				getFailedConnections(singleFailedInstallation, singleSubscription)
			).toEqual([{ deleted: true, id: 12345678, orgName: "fake-name" }]);
		});

		it("should return a single failed connection if 1 connection fails and 1 succeeds", async () => {
			const singleFailedAndSingleSuccessdulInstallation = require("../../fixtures/get-jira-configuration/single-successful-and-single-failed-installations");
			expect(
				getFailedConnections(
					singleFailedAndSingleSuccessdulInstallation,
					singleSubscription
				)
			).toHaveLength(1);
			expect(
				getFailedConnections(
					singleFailedAndSingleSuccessdulInstallation,
					singleSubscription
				)
			).toEqual([{ deleted: true, id: 12345678, orgName: "fake-name" }]);
		});

		it("should return a multiple failed connections if there is more than 1 failed connection", async () => {
			const multipleFailedInstallations = require("../../fixtures/get-jira-configuration/multiple-failed-installations");
			expect(
				getFailedConnections(multipleFailedInstallations, multipleSubscriptions)
			).toHaveLength(2);
			expect(
				getFailedConnections(multipleFailedInstallations, multipleSubscriptions)
			).toEqual([
				{ deleted: true, id: 12345678, orgName: "fake-name" },
				{ deleted: true, id: 23456789, orgName: "fake-name-two" },
			]);
		});

		it("should return a multiple failed connections if there are multiple successful and failed connections", async () => {
			const multipleFailedAndSuccessfulInstallations = require("../../fixtures/get-jira-configuration/muliple-successful-and-multiple-failed-installations");
			expect(
				getFailedConnections(
					multipleFailedAndSuccessfulInstallations,
					multipleSubscriptions
				)
			).toHaveLength(2);
			expect(
				getFailedConnections(
					multipleFailedAndSuccessfulInstallations,
					multipleSubscriptions
				)
			).toEqual([
				{ deleted: true, id: 12345678, orgName: "fake-name" },
				{ deleted: true, id: 23456789, orgName: "fake-name-two" },
			]);
		});

		it("should return 'undefined' for the orgName of subscriptions with no repos", async () => {
			const singleFailedInstallation = require("../../fixtures/get-jira-configuration/single-failed-installation");

			expect(
				getFailedConnections(singleFailedInstallation, subscriptionWithNoRepos)
			).toHaveLength(1);
			expect(
				getFailedConnections(singleFailedInstallation, subscriptionWithNoRepos)
			).toEqual([{ deleted: true, id: 12345678, orgName: undefined }]);
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
		});*/
});
