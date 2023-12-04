
import express, { Application, NextFunction, Request, Response } from "express";
import { getLogger } from "~/src/config/logger";
import { ApiRouter } from "./api-router";
import supertest from "supertest";
import { Subscription, SyncStatus } from "~/src/models/subscription";
import { Installation } from "~/src/models/installation";
import { createHashWithSharedSecret } from "~/src/util/encryption";
import { RepoSyncState } from "~/src/models/reposyncstate";
import {  booleanFlag } from "../../config/feature-flags";
import { mocked } from "jest-mock";


jest.mock("config/feature-flags");
const mockBooleanFlag = mocked(booleanFlag);

describe("api-replay-failed-entities-from-data-depot", () => {

	const MOCK_SYSTEM_TIMESTAMP_SEC = 12345678;

	let app: Application;
	let subscription: Subscription;
	const gitHubInstallationId = 1234;

	const createApp = () => {
		const app = express();
		app.use((req: Request, _: Response, next: NextFunction) => {
			req.log = getLogger("test");
			next();
		});
		app.use("/api", ApiRouter);
		return app;
	};

	beforeEach(async () => {
		await Installation.create({
			gitHubInstallationId,
			jiraHost,
			encryptedSharedSecret: "secret",
			clientKey: "client-key"
		});

		subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: "client-key",
			syncStatus: SyncStatus.PENDING
		});

		await RepoSyncState.create({
			subscriptionId: subscription.id,
			repoId: 1,
			repoName: "repo-0",
			repoOwner: "atlassian",
			repoFullName: "atlassian/github-for-jira",
			repoUrl: "github.com/atlassian/github-for-jira"
		});

		mockSystemTime(MOCK_SYSTEM_TIMESTAMP_SEC);
		mockBooleanFlag.mockResolvedValue(true);

	});

	it("should return 400 if slauth header is missing", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.then((res) => {
				expect(res.status).toBe(401);
			});
	});

	it("should return message if input is empty", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.send({ replayEntities: [] })
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("Replay entities are empty");
			});
	});

	it("should log error message if subscription is not found", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.send({
				replayEntities: [{
					"gitHubInstallationId": 123,
					"hashedJiraHost": "hashedJiraHost",
					"identifier": "d-1234567-1"
				}]
			})
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("No subscription found");
			});
	});

	it("should log error message if unknown identifier passed", async () => {
		app = createApp();

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.send({
				replayEntities: [{
					"gitHubInstallationId": subscription.gitHubInstallationId,
					"hashedJiraHost": createHashWithSharedSecret(subscription.jiraHost),
					"identifier": "x-1234567-1"
				}]
			})
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("Identifier format unknown");
			});
	});

	it("should replay dependabot alert", async () => {
		app = createApp();
		githubUserTokenNock(subscription.gitHubInstallationId);
		githubNock
			.get("/repos/atlassian/repo-0/dependabot/alerts/10")
			.reply(200, dependabotAlert);

		jiraNock
			.post("/rest/security/1.0/bulk", expectedDependabotAlertResponse(subscription))
			.reply(200, { rejectedEntities: [] });

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.send({
				replayEntities: [{
					"gitHubInstallationId": subscription.gitHubInstallationId,
					"hashedJiraHost": createHashWithSharedSecret(subscription.jiraHost),
					"identifier": "d-1-10"
				}]
			})
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("Replay entity processed successfully for d-1-10");
			});
	});

	it("should replay code scanning alert", async () => {
		app = createApp();
		githubUserTokenNock(subscription.gitHubInstallationId);
		githubNock
			.get("/repos/atlassian/repo-0/code-scanning/alerts/11")
			.reply(200, codeScanningAlert);

		jiraNock
			.post("/rest/security/1.0/bulk")
			.reply(200, { rejectedEntities: [] });

		await supertest(app)
			.post(`/api/replay-rejected-entities-from-data-depot`)
			.send({
				replayEntities: [{
					"gitHubInstallationId": subscription.gitHubInstallationId,
					"hashedJiraHost": createHashWithSharedSecret(subscription.jiraHost),
					"identifier": "c-1-11"
				}]
			})
			.set("X-Slauth-Mechanism", "asap")
			.then((res) => {
				expect(res.text).toContain("Replay entity processed successfully for c-1-11");
			});
	});


});

const dependabotAlert = {
	"number": 10,
	"state": "OPEN",
	"created_at": "2023-07-13T06:24:50Z",
	"updated_at": "2023-07-13T06:24:50Z",
	"dismissed_at": null,
	"dependency": {
		"scope": "runtime",
		"manifest_path": "yarn.lock"
	},
	"security_vulnerability": {
		"severity": "MODERATE"
	},
	"security_advisory": {
		"summary": "semver vulnerable to Regular Expression Denial of Service",
		"description": "Versions of the package semver before 7.5.2 on the 7.x branch, before 6.3.1 on the 6.x branch, and all other versions before 5.7.2 are vulnerable to Regular Expression Denial of Service (ReDoS) via the function new Range, when untrusted user data is provided as a range.",
		"identifiers": [
			{
				"type": "GHSA",
				"value": "GHSA-c2qf-rxjj-qqgw"
			},
			{
				"type": "CVE",
				"value": "CVE-2022-25883"
			}
		],
		"references": [
			{
				"url": "https://nvd.nist.gov/vuln/detail/CVE-2022-25883"
			},
			{
				"url": "https://github.com/npm/node-semver/pull/564"
			},
			{
				"url": "https://github.com/npm/node-semver/commit/717534ee353682f3bcf33e60a8af4292626d4441"
			},
			{
				"url": "https://security.snyk.io/vuln/SNYK-JS-SEMVER-3247795"
			},
			{
				"url": "https://github.com/npm/node-semver/blob/main/classes/range.js#L97-L104"
			},
			{
				"url": "https://github.com/npm/node-semver/blob/main/internal/re.js#L138"
			},
			{
				"url": "https://github.com/npm/node-semver/blob/main/internal/re.js#L160"
			},
			{
				"url": "https://github.com/npm/node-semver/pull/585"
			},
			{
				"url": "https://github.com/npm/node-semver/commit/928e56d21150da0413a3333a3148b20e741a920c"
			},
			{
				"url": "https://github.com/npm/node-semver/pull/593"
			},
			{
				"url": "https://github.com/npm/node-semver/commit/2f8fd41487acf380194579ecb6f8b1bbfe116be0"
			},
			{
				"url": "https://github.com/advisories/GHSA-c2qf-rxjj-qqgw"
			}
		]
	},
	"repository": {
		"id": 586512978,
		"url": "https://github.com/atlassian/repo-0"
	}
};

const expectedDependabotAlertResponse = (subscription: Subscription) => ({
	"vulnerabilities": [
		{
			"schemaVersion": "1.0",
			"id": "d-1-10",
			"updateSequenceNumber": 12345678,
			"containerId": "1",
			"displayName": "semver vulnerable to Regular Expression Denial of Service",
			"description": "**Vulnerability:** semver vulnerable to Regular Expression Denial of Service\n\n**Impact:** Versions of the package semver before 7.5.2 on the 7.x branch, before 6.3.1 on the 6.x branch, and all other versions before 5.7.2 are vulnerable to Regular Expression Denial of Service (ReDoS) via the function new Range, when untrusted user data is provided as a range.\n\n**Severity:**  - undefined\n\nGitHub uses  [Common Vulnerability Scoring System (CVSS)](https://www.atlassian.com/trust/security/security-severity-levels) data to calculate security severity.\n\n**State:** Open\n\n**Patched version:** undefined\n\n**Identifiers:**\n\n- [GHSA-c2qf-rxjj-qqgw](https://github.com/advisories/GHSA-c2qf-rxjj-qqgw)\n- [CVE-2022-25883](https://nvd.nist.gov/vuln/detail/CVE-2022-25883)\n\nVisit the vulnerability’s [dependabot alert page](undefined) in GitHub to learn more about and see remediation options.",
			"type": "sca",
			"introducedDate": "2023-07-13T06:24:50Z",
			"lastUpdated": "2023-07-13T06:24:50Z",
			"severity": {
				"level": "medium"
			},
			"identifiers": [
				{
					"displayName": "GHSA-c2qf-rxjj-qqgw",
					"url": "https://github.com/advisories/GHSA-c2qf-rxjj-qqgw"
				},
				{
					"displayName": "CVE-2022-25883",
					"url": "https://nvd.nist.gov/vuln/detail/CVE-2022-25883"
				}
			],
			"status": "open",
			"additionalInfo": {
				"content": "yarn.lock"
			}
		}
	],
	"properties": {
		"gitHubInstallationId": subscription.gitHubInstallationId,
		"workspaceId": subscription.id
	},
	"operationType": "NORMAL"
});

const codeScanningAlert = {
	"number": 11,
	"created_at": "2023-08-18T04:33:51Z",
	"updated_at": "2023-08-18T04:33:51Z",
	"url": "https://api.github.com/repos/auzwang/sequelize-playground/code-scanning/alerts/9",
	"html_url": "https://github.com/auzwang/sequelize-playground/security/code-scanning/9",
	"state": "open",
	"fixed_at": null,
	"dismissed_by": null,
	"dismissed_at": null,
	"dismissed_reason": null,
	"dismissed_comment": null,
	"rule": {
		"id": "js/reflected-xss",
		"severity": "error",
		"description": "Reflected cross-site scripting",
		"name": "js/reflected-xss",
		"tags": ["external/cwe/cwe-079", "external/cwe/cwe-116", "security"],
		"security_severity_level": "medium"
	},
	"tool": { "name": "CodeQL", "guid": null, "version": "2.14.1" },
	"most_recent_instance": {
		"ref": "refs/heads/master",
		"analysis_key": "dynamic/github-code-scanning/codeql:analyze",
		"environment": "{\"language\":\"javascript\"}",
		"category": "/language:javascript",
		"state": "open",
		"commit_sha": "0177549c9c9eb86de42f4689f0a681f72acdfa65",
		"message": {
			"text": "Cross-site scripting vulnerability due to a user-provided value."
		},
		"location": {
			"path": "index.js",
			"start_line": 10,
			"end_line": 10,
			"start_column": 12,
			"end_column": 24
		},
		"classifications": []
	},
	"instances_url": "https://api.github.com/repos/auzwang/sequelize-playground/code-scanning/alerts/9/instances"
};
