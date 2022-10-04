import { transformCodeScanningAlert } from "./transform-code-scanning-alert";
import codeScanningPayload from "./../../test/fixtures/api/code-scanning-alert.json";
import { getLogger } from "config/logger";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { Installation } from "models/installation";
import { GitHubServerApp } from "models/github-server-app";
import fs from "fs";
import path from "path";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { GitHubAppConfig } from "~/src/sqs/sqs.types";

jest.mock("config/feature-flags");

const buildContext = (payload, gitHubAppConfig?: GitHubAppConfig): WebhookContext => {
	return new WebhookContext({
		"id": "hi",
		"name": "hi",
		"payload": payload,
		gitHubAppConfig: gitHubAppConfig,
		log: getLogger("foo")
	});
};

const turnOnGHESFF = () => {
	when(jest.mocked(booleanFlag))
		.calledWith(BooleanFlags.GHE_SERVER, expect.anything(), expect.anything())
		.mockResolvedValue(true);
};

describe("code_scanning_alert transform", () => {
	beforeEach(() => {
		Date.now = jest.fn(() => 12345678);
	});
	const gitHubInstallationId = 1234;
	const jiraHost = "testHost";

	it("code_scanning_alert is transformed into a remote link for Cloud", async () => {
		const remoteLinks = await transformCodeScanningAlert(buildContext(codeScanningPayload), gitHubInstallationId, jiraHost);
		expect(remoteLinks).toMatchObject({
			remoteLinks: [{
				schemaVersion: "1.0",
				id: "403470608-272",
				updateSequenceNumber: 12345678,
				displayName: "Alert #272",
				description: "Reflected cross-site scripting",
				url: "https://github.com/TerryAg/github-jira-test/security/code-scanning/272",
				type: "security",
				status: {
					appearance: "removed",
					label: "open"
				},
				lastUpdated: "2021-09-06T06:00:00Z",
				associations: [{
					associationType: "issueKeys",
					values: ["GH-9"]
				}]
			}]
		});
	});

	it("code_scanning_alert is transformed into a remote link for server", async () => {
		turnOnGHESFF();

		const installationForGhes = await Installation.create({
			gitHubInstallationId: gitHubInstallationId,
			jiraHost,
			encryptedSharedSecret: "secret",
			clientKey: "client-key"
		});

		const gitHubServerApp = await GitHubServerApp.create({
			uuid: "329f2718-76c0-4ef8-83c6-66d7f1767e0d",
			appId: 12321,
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "client-id",
			gitHubClientSecret: "client-secret",
			webhookSecret: "webhook-secret",
			privateKey: fs.readFileSync(path.resolve(__dirname, "../../test/setup/test-key.pem"), { encoding: "utf8" }),
			gitHubAppName: "app-name",
			installationId: installationForGhes.id
		});

		const subscriptionForGhe = await Subscription.create({
			gitHubInstallationId: gitHubInstallationId,
			jiraHost,
			syncStatus: "ACTIVE",
			repositoryStatus: "complete",
			gitHubAppId: gitHubServerApp.id
		});

		await RepoSyncState.create({
			subscriptionId: subscriptionForGhe.id,
			repoId: 1,
			repoName: "test-repo-name",
			repoOwner: "integrations",
			repoFullName: "test-repo-name",
			repoUrl: "test-repo-url",
			repoPushedAt: new Date(),
			repoUpdatedAt: new Date(),
			repoCreatedAt: new Date(),
			branchStatus: "complete",
			commitStatus: "pending", // We want the next process to be commits
			pullStatus: "complete",
			updatedAt: new Date(),
			createdAt: new Date()
		});

		const remoteLinks = await transformCodeScanningAlert(buildContext(codeScanningPayload, {
			gitHubAppId: gitHubServerApp.id,
			appId: gitHubServerApp.appId,
			clientId: gitHubServerApp.gitHubClilentId,
			gitHubBaseUrl: gitHubServerApp.gitHubBaseUrl,
			gitHubApiUrl: gitHubServerApp.gitHubBaseUrl + "/api",
			uuid: gitHubServerApp.uuid
		}), gitHubInstallationId, jiraHost);

		expect(remoteLinks).toMatchObject({
			remoteLinks: [{
				schemaVersion: "1.0",
				id: "6769746875626d79646f6d61696e636f6d-403470608-272",
				updateSequenceNumber: 12345678,
				displayName: "Alert #272",
				description: "Reflected cross-site scripting",
				url: "https://github.com/TerryAg/github-jira-test/security/code-scanning/272",
				type: "security",
				status: {
					appearance: "removed",
					label: "open"
				},
				lastUpdated: "2021-09-06T06:00:00Z",
				associations: [{
					associationType: "issueKeys",
					values: ["GH-9"]
				}]
			}]
		});
	});

	it("manual code_scanning_alert maps to multiple Jira issue keys", async () => {
		const payload = { ...codeScanningPayload, action: "closed_by_user" };
		const remoteLinks = await transformCodeScanningAlert(buildContext(payload), gitHubInstallationId, jiraHost);
		expect(remoteLinks?.remoteLinks[0].associations[0].values).toEqual(["GH-9", "GH-10", "GH-11"]);
	});

	it("code_scanning_alert truncates to a shorter description if too long", async () => {
		const payload = {
			...codeScanningPayload,
			alert: { ...codeScanningPayload.alert, rule: { ...codeScanningPayload.alert.rule, description: "A".repeat(300) } }
		};
		const remoteLinks = await transformCodeScanningAlert(buildContext(payload), gitHubInstallationId, jiraHost);
		expect(remoteLinks?.remoteLinks[0].description).toHaveLength(255);
	});

	it("code_scanning_alert with pr reference queries Pull Request title - GH Client", async () => {
		const payload = { ...codeScanningPayload, ref: "refs/pull/8/merge" };
		const context = buildContext(payload);

		githubUserTokenNock(gitHubInstallationId);
		githubNock.get(`/repos/TerryAg/github-jira-test/pulls/8`)
			.reply(200, {
				title: "GH-10"
			});

		const remoteLinks = await transformCodeScanningAlert(context, gitHubInstallationId, jiraHost);
		expect(remoteLinks?.remoteLinks[0].associations[0].values[0]).toEqual("GH-10");
	});
});
