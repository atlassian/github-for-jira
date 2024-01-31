import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { getJiraClient, JiraClient, ISSUE_KEY_API_LIMIT, issueKeyLimitWarning } from "./jira-client";
import { JiraDeploymentBulkSubmitData, JiraBuildBulkSubmitData } from "interfaces/jira";
import { getHashedKey } from "models/sequelize";
import * as Axios from "./axios";
import { when } from "jest-when";
import { BooleanFlags, booleanFlag } from "~/src/config/feature-flags";

jest.mock("config/feature-flags");

describe("Test getting a jira client", () => {
	const gitHubInstallationId = Math.round(Math.random() * 10000);
	let subscription: Subscription;
	let client: JiraClient;

	beforeEach(async () => {
		await Installation.install({
			host: jiraHost,
			sharedSecret: "shared-secret",
			clientKey: "client-key"
		});
		subscription = await Subscription.create({
			jiraHost,
			gitHubInstallationId
		});
		client = (await getJiraClient(jiraHost, gitHubInstallationId, undefined, undefined))!;
	});

	it("Installation exists", async () => {
		expect(client).toMatchSnapshot();
	});

	it("Installation does not exist", async () => {
		expect(await getJiraClient("https://non-existing-url.atlassian.net", gitHubInstallationId, undefined, undefined)).not.toBeDefined();
	});

	it("Subscription does not exist", async () => {
		when(booleanFlag).calledWith(BooleanFlags.ENABLE_GITHUB_SECURITY_IN_JIRA, expect.anything()).mockResolvedValue(true);

		expect(await getJiraClient(jiraHost, 123456, undefined, undefined)).not.toBeDefined();
	});

	it("Should truncate issueKeys for commits if over the limit", async () => {
		jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

		await client.devinfo.repository.update({
			commits: [
				{
					author: {
						email: "blarg@email.com",
						name: "foo"
					},
					authorTimestamp: "Tue Oct 19 2021 11:52:08 GMT+1100",
					displayId: "oajfojwe",
					fileCount: 3,
					hash: "hashihashhash",
					id: "id",
					issueKeys: Array.from(new Array(525)).map((_, i) => `TEST-${i}`),
					message: "commit message",
					url: "some-url",
					updateSequenceId: 1234567890
				}
			]
		});
		await subscription.reload();
		expect(subscription.syncWarning).toEqual("Exceeded issue key reference limit. Some issues may not be linked.");
	});

	it("Should truncate issueKeys for branches if over the limit", async () => {
		jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

		await client.devinfo.repository.update({
			branches: [
				{
					createPullRequestUrl: "pr-url",
					lastCommit: {
						author: {
							email: "blarg@email.com",
							name: "foo"
						},
						authorTimestamp: "Tue Oct 19 2021 11:52:08 GMT+1100",
						displayId: "oajfojwe",
						fileCount: 0,
						hash: "hashihashhash",
						id: "id",
						issueKeys: "TEST-123",
						message: "commit message",
						url: "some-url",
						updateSequenceId: 1234567890
					},
					id: "jiraId",
					issueKeys: Array.from(new Array(525)).map((_, i) => `TEST-${i}`),
					name: "ref",
					url: "branch-url",
					updateSequenceId: 1234567890
				}
			]
		});
		await subscription.reload();
		expect(subscription.syncWarning).toEqual("Exceeded issue key reference limit. Some issues may not be linked.");
	});

	it("Should truncate issueKeys for pull requests if over the limit", async () => {
		jiraNock.post("/rest/devinfo/0.10/bulk").reply(200);

		await client.devinfo.repository.update({
			pullRequests: [
				{
					author: {
						email: "blarg@email.com",
						name: "foo"
					},
					commentCount: 3,
					destinationBranch: "dest-branch",
					destinationBranchUrl: "dest-branch-url",
					displayId: "#5",
					id: 6,
					issueKeys: Array.from(new Array(525)).map((_, i) => `TEST-${i}`),
					reviewers: [],
					sourceBranch: "source-branch",
					sourceBranchUrl: "source-branch-url",
					status: "MERGED",
					timestamp: "Tue Oct 19 2021 11:52:08 GMT+1100",
					title: "pr title",
					url: "pr-url",
					updateSequenceId: 1234567890
				}
			]
		});
		await subscription.reload();
		expect(subscription.syncWarning).toEqual("Exceeded issue key reference limit. Some issues may not be linked.");
	});

	it("Should delete devinfo, builds, and deployments for an installation", async () => {
		jiraNock.delete("/rest/devinfo/0.10/bulkByProperties").query({
			installationId: "12345"
		}).reply(202);

		jiraNock.delete("/rest/builds/0.1/bulkByProperties").query({
			gitHubInstallationId: "12345"
		}).reply(202);

		jiraNock.delete("/rest/deployments/0.1/bulkByProperties").query({
			gitHubInstallationId: "12345"
		}).reply(202);

		const resp = await client.devinfo.installation.delete(12345);
		expect(resp.map((r: {status: number}) => r.status)).toEqual([202, 202, 202]);

		// no assertion necessary; nock will complain if one of the mocked endpoints is not called
	});

	it("Should return success response for the bulk API redirects", async () => {
		jiraNock.get("/status").reply(200);
		jiraNock.get("/rest/devinfo/0.10/bulk").reply(405);
		jiraNock.post("/rest/devinfo/0.10/bulk").reply(302, undefined, {
			"Location": jiraHost + "/rest/devinfo/0.10/bulk"
		});

		const response = await client.devinfo.repository.update({
			commits: [
				{
					author: {
						email: "blarg@email.com",
						name: "foo"
					},
					authorTimestamp: "Tue Oct 19 2021 11:52:08 GMT+1100",
					displayId: "oajfojwe",
					fileCount: 3,
					hash: "hashihashhash",
					id: "id",
					issueKeys: Array.from(new Array(525)).map((_, i) => `TEST-${i}`),
					message: "commit message",
					url: "some-url",
					updateSequenceId: 1234567890
				}
			]
		});

		expect(response).toMatchObject([{ result: "SKIP_REDIRECTED" }]);
	});

	it("Should return success response for the deployment bulk API redirects", async () => {
		jiraNock.get("/status").reply(200);
		jiraNock.get("/rest/deployments/0.1/bulk").reply(405);
		jiraNock.post("/rest/deployments/0.1/bulk").reply(302, undefined, {
			"Location": jiraHost + "/rest/deployments/0.1/bulk"
		});
		const repoFullName: string = "react-code-hub";
		const response = await client.deployment.submit({
			deployments: [{}]
		} as JiraDeploymentBulkSubmitData, 1, repoFullName);

		expect(response).toEqual({
			status: 200,
			rejectedDeployments: undefined
		});
	});

	it("Should return success response for the build bulk API redirects", async () => {
		jiraNock.get("/status").reply(200);
		jiraNock.get("/rest/builds/0.1/bulk").reply(405);
		jiraNock.post("/rest/builds/0.1/bulk").reply(302, undefined, {
			"Location": jiraHost + "/rest/builds/0.1/bulk"
		});

		const response = await client.workflow.submit({
			builds: [{}]
		} as JiraBuildBulkSubmitData, 1, "", {
			auditLogsource: "WEBHOOK",
			operationType: "NORMAL",
			preventTransitions: false,
			subscriptionId: subscription.id
		});

		expect(response).toEqual({
			status: 200,
			result: "SKIP_REDIRECTED"
		});
	});

	describe("Reading encryptedSharedSecret", () => {
		beforeEach(async ()=>{
			const inst: Installation | null = await Installation.findOne({
				where: {
					clientKey: getHashedKey("client-key")
				}
			});
			await inst?.update({
				encryptedSharedSecret: "new-encrypted-shared-secret"
			});
		});
		it("should use new encrypted shared secret field", async () => {
			jest.spyOn(Axios, "getAxiosInstance");
			client = (await getJiraClient(jiraHost, gitHubInstallationId, undefined, undefined))!;
			expect(Axios.getAxiosInstance).toHaveBeenCalledWith(
				expect.anything(),
				"new-encrypted-shared-secret",
				expect.anything()
			);
		});
	});

	it("Should delete devinfo, builds, and deployments for a repository", async () => {
		const currentMockDate = Date.now = jest.fn(() => 1487076708000);

		jiraNock.delete("/rest/devinfo/0.10/repository/6769746875626261736574657374636f6d-123").query({
			_updateSequenceId: currentMockDate()
		}).reply(202);

		jiraNock.delete("/rest/builds/0.1/bulkByProperties").query({
			repositoryId: 123
		}).reply(202);

		jiraNock.delete("/rest/deployments/0.1/bulkByProperties").query({
			repositoryId: 123
		}).reply(202);

		const jiraRes = await client.devinfo.repository.delete(123, "https://githubBaseTest.com");
		expect(jiraRes[0].status).toEqual(202);
	});

	it("should truncate deployment issue keys if exceed limit", async () => {

		jiraNock.post("/rest/deployments/0.1/bulk").reply(200);
		const repoFullName: string = "react-code-hub";
		await client.deployment.submit({
			deployments: [
				{
					schemaVersion: "1",
					deploymentSequenceNumber: 1,
					updateSequenceNumber: 2,
					displayName: "hello",
					url: "url",
					description: "",
					lastUpdated: new Date(),
					state: "success",
					pipeline: {
						id: "123",
						displayName: "p123",
						url: "pUrl"
					},
					environment: {
						id: "4",
						displayName: "prod",
						type: "prod"
					},
					associations: [{
						associationType: "issueIdOrKeys",
						values: Array.from(new Array(ISSUE_KEY_API_LIMIT + 1)).map((_, i) => `TSTDEP-${i}`)
					}]
				}
			]
		}, 1, repoFullName, {
			auditLogsource: "WEBHOOK",
			operationType: "NORMAL",
			preventTransitions: false,
			subscriptionId: subscription.id
		});
		await subscription.reload();
		expect(subscription.syncWarning).toEqual(issueKeyLimitWarning);

	});

});
