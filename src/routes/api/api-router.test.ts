/* eslint-disable @typescript-eslint/no-explicit-any */
import supertest from "supertest";
import { Application } from "express";
import { Installation } from "models/installation";
import { Subscription, SyncStatus } from "models/subscription";
import { GitHubServerApp } from "models/github-server-app";
import { RepoSyncState } from "models/reposyncstate";
import { v4 as uuid } from "uuid";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { getFrontendApp } from "~/src/app";

jest.mock("config/feature-flags");

describe("API Router", () => {
	let app: Application;
	const invalidId = 99999999;
	const gitHubInstallationId = 1234;
	let installation: Installation;
	let subscription: Subscription;
	let gitHubServerApp: GitHubServerApp;

	beforeEach(async () => {
		app = getFrontendApp();

		installation = await Installation.create({
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

		gitHubServerApp = await GitHubServerApp.install({
			uuid: uuid(),
			appId: 123,
			installationId: installation.id,
			gitHubAppName: "test-github-server-app",
			gitHubBaseUrl: gheUrl,
			gitHubClientId: "client-id",
			gitHubClientSecret: "client-secret",
			privateKey: "private-key",
			webhookSecret: "webhook-secret"
		}, jiraHost);

		await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: "client-key",
			gitHubAppId: gitHubServerApp.id
		});
	});

	it("should GET syncstate", async () => {

		await supertest(app)
			.get(`/api/${subscription.gitHubInstallationId}/${encodeURIComponent(subscription.jiraHost)}/syncstate?limit=100&offset=0`)
			.set("X-Slauth-Mechanism", "asap")
			.then((response) => {
				expect(response.body).toMatchObject({
					jiraHost,
					gitHubInstallationId,
					numberOfSyncedRepos: 0,
					totalNumberOfRepos: 0,
					repositories: []
				});
			});
	});

	describe("Authentication based on SLAuth headers", () => {
		it("Request allowed when Authentication Mechanism is ASAP", () => {
			return supertest(app)
				.get("/api")
				.set("X-Slauth-Mechanism", "asap")
				.set("X-Slauth-Principal", "pollinator-check/fea5d423-e21f-465b-aa67-54c8367b7777")
				.expect(200)
				.then((response) => {
					expect(response.body).toMatchSnapshot();
				});
		});

		it("Request allowed when Authentication Mechanism is SLAuth Token", () => {
			return supertest(app)
				.get("/api")
				.set("X-Slauth-Mechanism", "slauthtoken")
				.set("X-Slauth-Principal", "group")
				.set("X-Slauth-User-Groups", "micros-sv--github-for-jira-dl-admins")
				.expect(200)
				.then((response) => {
					expect(response.body).toMatchSnapshot();
				});
		});

		it("should return 401 no SLauth Headers", () => {

			return supertest(app)
				.get("/api")
				.then((response) => {
					expect(response.status).toEqual(401);
				});
		});

		it("should return 401 when Authentication Mechanism is Open", () => {

			return supertest(app)
				.get("/api")
				.set("X-Slauth-Mechanism", "open")
				.then((response) => {
					expect(response.status).toEqual(401);
				});
		});
	});

	describe("Endpoints", () => {

		describe("verify", () => {
			it("should return 'Installation already enabled'", () => {
				jiraNock
					.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")
					.reply(200);

				return supertest(app)
					.post(`/api/jira/${installation.id}/verify`)
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(200)
					.expect("Content-Type", /json/)
					.then((response) => {
						expect(response.body.message).toMatchSnapshot();
					});
			});
		});

		describe("installation", () => {
			it("should return 404 if no installation is found", async () => {
				return supertest(app)
					.get(`/api/${invalidId}`)
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(404)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("should return a failed connection when subscription is fucked", async () => {
				githubNock.get(`/app/installations/${gitHubInstallationId}`).reply(500, { boom: "kaboom" });
				return supertest(app)
					.get(`/api/${gitHubInstallationId}`)
					.set("host", "127.0.0.1")
					.send({ jiraHost })
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("should return a connection when subscription is OK", async () => {
				githubNock.get(`/app/installations/${gitHubInstallationId}`).reply(200, { foo: "bar" });
				return supertest(app)
					.get(`/api/${gitHubInstallationId}`)
					.set("host", "127.0.0.1")
					.send({ jiraHost })
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});
		});

		describe("Repo Sync State", () => {
			beforeEach(async () => {
				await subscription.update({ numberOfSyncedRepos: 1 });
				await RepoSyncState.create({
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

			it("should return 404 if no installation is found", async () => {
				return supertest(app)
					.get(`/api/${invalidId}/${encodeURIComponent(jiraHost)}/syncstate?limit=100&offset=0`)
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.send({ jiraHost })
					.expect(404)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("should return the sync state for an existing installation", async () => {
				return supertest(app)
					.get(`/api/${gitHubInstallationId}/${encodeURIComponent(jiraHost)}/syncstate?limit=100&offset=0`)
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchObject({
							jiraHost,
							gitHubInstallationId,
							numberOfSyncedRepos: 1,
							totalNumberOfRepos: 1,
							repositories: [{
								pullStatus: "complete",
								branchStatus: "complete",
								commitStatus: "complete",
								buildStatus: "complete",
								deploymentStatus: "complete",
								repoId: 1,
								repoName: "github-for-jira",
								repoFullName: "atlassian/github-for-jira",
								repoUrl: "github.com/atlassian/github-for-jira",
								repoOwner: "atlassian",
								repoUpdatedAt: new Date(0).toISOString()
							}]
						});
					});
			});
		});

		describe("sync", () => {
			it("should return 404 if no installation is found", async () => {
				return supertest(app)
					.post(`/api/${invalidId}/sync`)
					.set("Content-Type", "application/json")
					.send({ jiraHost: "https://unknownhost.atlassian.net" })
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(404)
					.then((response) => {
						expect(response.text).toMatchSnapshot();
					});
			});

			it("should trigger the sync or start function", async () => {
				return supertest(app)
					.post(`/api/${gitHubInstallationId}/sync`)
					.set("Content-Type", "application/json")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.send({ jiraHost })
					.expect(202)
					.then((response) => {
						expect(response.text).toMatchSnapshot();
					});
			});

			it("should reset sync state if asked to", async () => {
				return supertest(app)
					.post(`/api/${gitHubInstallationId}/sync`)
					.set("Content-Type", "application/json")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.send({ jiraHost, resetType: "full" })
					.expect(202)
					.then((response) => {
						expect(response.text).toMatchSnapshot();
					});
			});
		});

		describe("Delete Installation", () => {
			beforeEach(() => {
				jiraNock
					.delete("/rest/devinfo/0.10/bulkByProperties")
					.query({ installationId: gitHubInstallationId })
					.reply(200);

				jiraNock
					.delete("/rest/builds/0.1/bulkByProperties")
					.query({ gitHubInstallationId })
					.reply(200);

				jiraNock
					.delete("/rest/deployments/0.1/bulkByProperties")
					.query({ gitHubInstallationId })
					.reply(200);
			});

			it("Should work with new delete installation route", () => {
				return supertest(app)
					.delete(`/api/${gitHubInstallationId}/${encodeURIComponent(jiraHost)}`)
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});
		});

		describe("Hash data", () => {

			it("Should return error with message if no data provided", () => {
				return supertest(app)
					.post("/api/hash")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(400)
					.then((response) => {
						expect(response.body?.message).toEqual("Please provide a value to be hashed.");
					});
			});

			it("Should return hashed value of data", () => {
				return supertest(app)
					.post("/api/hash")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.send({ data: "encrypt_this_yo" })
					.expect(200)
					.then((response) => {
						expect(response.body?.originalValue).toEqual("encrypt_this_yo");
						expect(response.body?.hashedValue).toEqual("a539e6c6809cabace5719df6c7fb52071ee15e722ba89675f6ad06840edaa287");
					});
			});

		});

		describe("Recrypt data", () => {

			it("Should recrypt data in different context", () => {
				return supertest(app)
					.post("/api/recrypt")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.send({
						encryptedValue: "encrypted:blah",
						key: "github-server-app-secrets",
						oldContext: {
							jiraHost: "https://blah.atlassian.com"
						},
						newContext: {
							jiraHost: "https://foo.atlassian.com"
						}
					})
					.expect(200)
					.then((response) => {
						expect(response.body.recryptedValue).toEqual("encrypted:blah");
					});
			});

		});

		describe("fill-mem-and-generate-coredump", () => {
			it("should return 200", () => {
				return supertest(app)
					.post("/api/fill-mem-and-generate-coredump?arraySize=2&nIter=7")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(200)
					.then((response) => {
						expect(response.body).toEqual({ allocated: 14, dumpGenerated: false });
					});
			});
		});

		describe("abort", () => {
			let origAbort: () => never;
			beforeEach(() => {
				origAbort = process.abort;
				process.abort = jest.fn() as unknown as () => never;
			});

			afterEach(() => {
				process.abort = origAbort;
			});

			it("should abort the process", () => {
				return supertest(app)
					.post("/api/abort")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(200)
					.then(() => {
						expect(process.abort).toBeCalled();
					});
			});
		});

		describe("drop-all-pr-cursor", () => {
			it("drops pullCursor field of all RepoSyncState records", async () => {
				const repoSyncState = (await new DatabaseStateCreator().withActiveRepoSyncState().create()).repoSyncState!;
				repoSyncState.set("pullCursor", "blah");
				await repoSyncState.save();

				await supertest(app)
					.post("/api/drop-all-pr-cursor")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(200);

				await repoSyncState.reload();
				expect(repoSyncState.pullCursor).toBeNull();
			});
		});

		describe("Ping", () => {

			it("Should fail on missing url", () => {
				return supertest(app)
					.post("/api/ping")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.expect(400)
					.then((response) => {
						expect(response.body?.message).toEqual("Please provide a JSON object with the field 'url'.");
					});
			});

			it("Should return error on failed ping", () => {
				return supertest(app)
					.post("/api/ping")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.send({ data: { url: "http://github-does-not-exist.internal.atlassian.com" } })
					.expect(200)
					.then((response) => {
						expect(response.body?.error.code).toEqual("ENOTFOUND");
					});
			});

		});

		describe("ApiResetSubscriptionFailedTasks", () => {
			it("Should drop failed status for all failed tasks", async () => {
				const repoSyncState = (await new DatabaseStateCreator().withActiveRepoSyncState().repoSyncStateFailedForBranches().create()).repoSyncState!;

				await supertest(app)
					.post("/api/reset-subscription-failed-tasks")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.send({
						subscriptionId: repoSyncState.subscriptionId
					})
					.expect(200);

				const oneMore = await RepoSyncState.findByPk(repoSyncState.id);
				expect(oneMore?.branchStatus).toBeNull();
			});

			it("Should drop failed status for passed tasks", async () => {
				const repoSyncState = (await new DatabaseStateCreator().withActiveRepoSyncState().repoSyncStateFailedForBranches().create()).repoSyncState!;

				await supertest(app)
					.post("/api/reset-subscription-failed-tasks")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.send({
						subscriptionId: repoSyncState.subscriptionId,
						targetTasks: ["branch"]
					})
					.expect(200);

				const oneMore = await RepoSyncState.findByPk(repoSyncState.id);
				expect(oneMore?.branchStatus).toBeNull();
			});

			it("Should not update status for other tasks", async () => {
				const repoSyncState = (await new DatabaseStateCreator().withActiveRepoSyncState().repoSyncStateFailedForBranches().create()).repoSyncState!;

				await supertest(app)
					.post("/api/reset-subscription-failed-tasks")
					.set("host", "127.0.0.1")
					.set("X-Slauth-Mechanism", "slauthtoken")
					.send({
						subscriptionId: repoSyncState.subscriptionId,
						targetTasks: ["commit"]
					})
					.expect(200);

				const oneMore = await RepoSyncState.findByPk(repoSyncState.id);
				expect(oneMore?.branchStatus).toEqual("failed");
			});
		});
	});

});
