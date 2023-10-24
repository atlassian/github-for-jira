/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-var-requires */
import { JiraGet } from "./jira-get";
import { getInstallations } from "utils/github-installations-helper";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import singleInstallation from "fixtures/jira-configuration/single-installation.json";
import failedInstallation from "fixtures/jira-configuration/failed-installation.json";
import { getLogger } from "config/logger";
import express from "express";
import supertest from "supertest";
import { encodeSymmetric } from "atlassian-jwt";
import { getFrontendApp } from "~/src/app";

jest.mock("config/feature-flags");
jest.mock("utils/app-properties-utils");

describe("Jira Configuration Suite", () => {
	let subscription: Subscription;
	let installation: Installation;

	beforeEach(async () => {
		subscription = await Subscription.create({
			gitHubInstallationId: 15,
			jiraHost,
			jiraClientKey: "clientKey",
			syncWarning: "some warning",
			totalNumberOfRepos: 1
		});

		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "test-repo-name",
			repoOwner: "integrations",
			repoFullName: "integrations/test-repo-name",
			repoUrl: "test-repo-url",
			pullStatus: "pending",
			branchStatus: "complete",
			commitStatus: "complete"
		});

		installation = await Installation.create({
			jiraHost,
			clientKey: "abc123",
			//TODO: why? Comment this out make test works?
			//setting both fields make sequelize confused as it internally storage is just the "secrets"
			//secrets: "def234",
			encryptedSharedSecret: "ghi345"
		});
	});

	const mockRequest = (): any => ({
		query: { },
		csrfToken: jest.fn().mockReturnValue({}),
		log: {
			info: jest.fn(),
			warn: jest.fn(),
			error: jest.fn(),
			debug: jest.fn()
		}
	});

	const mockResponse = (): any => ({
		locals: {
			jiraHost,
			installation
		},
		render: jest.fn().mockReturnValue({}),
		status: jest.fn().mockReturnValue({}),
		send: jest.fn().mockReturnValue({})
	});

	it("should return success message after page is rendered", async () => {
		const response = mockResponse();
		githubNock
			.get(`/app/installations/15`)
			.reply(200, singleInstallation);

		await JiraGet(mockRequest(), response, jest.fn());

		expect(response.render).toHaveBeenCalledWith("jira-configuration.hbs", expect.objectContaining({
			hasConnections: true,
			ghCloud: {
				failedCloudConnections: [],
				successfulCloudConnections: [expect.anything()]
			}
		}));
	});

	describe("getInstallations", () => {
		let sub: Subscription;
		const logger = getLogger("MOCK");

		beforeEach(async () => {
			sub = await Subscription.create({
				gitHubInstallationId: 12345678,
				jiraHost,
				jiraClientKey: "myClientKey",
				totalNumberOfRepos: 0
			});
		});

		it("should return no success or failed connections if no subscriptions given", async () => {
			expect(await getInstallations([], logger, undefined)).toEqual({
				fulfilled: [],
				rejected: [],
				total: 0
			});
		});

		it("should return successful connections when installation exists", async () => {
			githubNock
				.get(`/app/installations/${sub.gitHubInstallationId}`)
				.reply(200, singleInstallation);

			expect(await getInstallations([sub], logger, undefined)).toMatchObject({
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
				.reply(404, failedInstallation);

			expect(await getInstallations([sub], logger, undefined)).toMatchObject({
				fulfilled: [],
				rejected: [{
					error: {
						status: 404
					},
					id: sub.gitHubInstallationId,
					deleted: true
				}]
			});
		});

		it("should return one successful connection if installation exists and one failed one if installation doesn't exist", async () => {
			const failedSub: Subscription = await Subscription.create({
				gitHubInstallationId: 123,
				jiraHost,
				jiraClientKey: "myClientKey"
			});

			githubNock
				.get(`/app/installations/${sub.gitHubInstallationId}`)
				.reply(200, singleInstallation);

			githubNock
				.get(`/app/installations/${failedSub.gitHubInstallationId}`)
				.reply(404, failedInstallation);

			expect(await getInstallations([sub, failedSub], logger, undefined)).toMatchObject({
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
						status: 404
						// documentation_url: "https://docs.github.com/rest/reference/apps#get-an-installation-for-the-authenticated-app"
					},
					id: failedSub.gitHubInstallationId,
					deleted: true
				}]
			});
		});

		it("should return a multiple failed connections if no installations exists", async () => {
			const failedSub: Subscription = await Subscription.create({
				gitHubInstallationId: 123,
				jiraHost,
				jiraClientKey: "myClientKey"
			});

			githubNock
				.get(`/app/installations/${sub.gitHubInstallationId}`)
				.reply(404, failedInstallation);

			githubNock
				.get(`/app/installations/${failedSub.gitHubInstallationId}`)
				.reply(404, failedInstallation);

			expect(await getInstallations([sub, failedSub], logger, undefined)).toMatchObject({
				fulfilled: [],
				rejected: [
					{
						error: {
							status: 404
						},
						id: sub.gitHubInstallationId,
						deleted: true
					},
					{
						error: {
							status: 404
						},
						id: failedSub.gitHubInstallationId,
						deleted: true
					}
				]
			});
		});

		it("should return successful connection with correct number of repos and sync status", async () => {
			await Promise.all([
				RepoSyncState.create({
					subscriptionId: sub.id,
					repoId: 1,
					repoName: "github-for-jira",
					repoOwner: "atlassian",
					repoFullName: "atlassian/github-for-jira",
					repoUrl: "github.com/atlassian/github-for-jira",
					pullStatus: "complete",
					commitStatus: "complete",
					branchStatus: "complete",
					buildStatus: "complete",
					deploymentStatus: "complete"
				}),
				RepoSyncState.create({
					subscriptionId: sub.id,
					repoId: 1,
					repoName: "github-for-jira",
					repoOwner: "atlassian",
					repoFullName: "atlassian/github-for-jira",
					repoUrl: "github.com/atlassian/github-for-jira",
					pullStatus: "pending",
					commitStatus: "complete",
					branchStatus: "complete",
					buildStatus: "complete",
					deploymentStatus: "complete"
				}),
				sub.update({ totalNumberOfRepos: 2 })
			]);

			githubNock
				.get(`/app/installations/${sub.gitHubInstallationId}`)
				.reply(200, singleInstallation);

			expect(await getInstallations([sub], logger, undefined)).toMatchObject({
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
});

describe.each([
	{
		url: "/jira/configuration",
		testSharedSecret: "test-secret",
		testQsh: "03bb62de90d9a341a303b5d4bb97ebf50fa8f9701aadc9de46b744d9abbd43bd"
	}, {
		url: "/jira",
		testSharedSecret: "test-secret",
		testQsh: "25af23d03ec867427e41d0f9d53ddbd8afc043869f24b0ab2aaaced7acaf34eb"
	}
])("Jira Route", (testData) => {
	const { url, testSharedSecret, testQsh } = testData;
	let frontendApp;

	beforeEach(async () => {
		await Installation.install({
			host: jiraHost,
			sharedSecret: testSharedSecret,
			clientKey: "jira-client-key"
		});
		frontendApp = express();
		frontendApp.use((request, _, next) => {
			request.query = {
				jwt: encodeSymmetric({
					qsh: testQsh,
					iss: "jira-client-key"
				}, testSharedSecret)
			};
			next();
		});
		frontendApp.use(getFrontendApp());
	});

	it(`Testing route: ${url}`, async () => {
		await supertest(frontendApp)
			.get(url)
			.expect(200)
			.then(response => {
				expect(response.text).toContain("<h1 class=\"jiraConfiguration__header__title\">GitHub configuration</h1>");
			});
	});

	describe("5ku new experience", () => {
		it("should redirect to new spa entry page on empty state if ff on", async () => {
			await supertest(frontendApp)
				.get(url)
				.expect(200)
				.then(response => {
					expect(response.text).toContain("<html>\n			<body></body>\n    	<script src=\"https://connect-cdn.atl-paas.net/all.js\"></script>\n			<script>AP.navigator.go( \"addonmodule\", { moduleKey: \"spa-index-page\", customData: { from: \"homepage\" } });</script>\n		</html>");
				});
		});
	});
});

