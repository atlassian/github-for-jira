/* eslint-disable @typescript-eslint/no-explicit-any */
import supertest from "supertest";
import express, { Application, NextFunction, Request, Response } from "express";
import { Installation } from "models/installation";
import { Subscription } from "models/subscription";
import { RepoSyncState } from "models/reposyncstate";
import { ApiRouter } from "routes/api/api-router";
import { getLogger } from "config/logger";

describe("API Router", () => {
	let app: Application;
	let locals;
	const invalidId = 99999999;
	const gitHubInstallationId = 1234;
	let installation: Installation;
	let subscription: Subscription;

	const createApp = () => {
		const app = express();
		app.use((req: Request, res: Response, next: NextFunction) => {
			res.locals = locals || {};
			req.log = getLogger("test");
			req.session = { jiraHost };
			next();
		});
		app.use("/api", ApiRouter);
		return app;
	};

	beforeEach(async () => {
		locals = {
			client: {
				apps: {
					getInstallation: jest.fn().mockResolvedValue({ data: {} })
				}
			}
		};
		app = createApp();

		installation = await Installation.create({
			gitHubInstallationId,
			jiraHost,
			sharedSecret: "secret",
			clientKey: "client-key"
		});

		subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: "client-key"
		});
	});

	it("should GET syncstate", async () => {

		await supertest(app)
			.get(`/api/${subscription.gitHubInstallationId}/${encodeURIComponent(subscription.jiraHost)}/syncstate`)
			.then((response) => {
				expect(response.text).toStrictEqual(`{"installationId":${gitHubInstallationId},"jiraHost":"${jiraHost}","numberOfSyncedRepos":0,"repos":{}}`);
			});
	});

	describe("Authentication is not handled on the App level anymore", () => {
		it("Doesnt matter if there is no token", () => {
			return supertest(app)
				.get("/api")
				.expect(200)
				.then((response) => {
					expect(response.body).toMatchSnapshot();
				});
		});

		it("should return 200 if authorization header set", () => {

			return supertest(app)
				.get("/api")
				.set("Authorization", "Bearer xxx")
				.expect(200)
				.then((response) => {
					expect(response.body).toMatchSnapshot();
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
					.expect(404)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("should return information for an existing installation", async () => {
				return supertest(app)
					.get(`/api/${gitHubInstallationId}`)
					.set("host", "127.0.0.1")
					.send({ jiraHost })
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});
		});

		describe("Repo Sync State", () => {
			beforeEach(async () => {
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
					repoUpdatedAt: new Date(0)
				});
			});

			it("should return 404 if no installation is found", async () => {
				return supertest(app)
					.get(`/api/${invalidId}/${encodeURIComponent(jiraHost)}/syncstate`)
					.set("host", "127.0.0.1")
					.send({ jiraHost })
					.expect(404)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("should return the sync state for an existing installation", async () => {
				return supertest(app)
					.get(`/api/${gitHubInstallationId}/${encodeURIComponent(jiraHost)}/syncstate`)
					.set("host", "127.0.0.1")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchObject({
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
										updated_at: new Date(0).toISOString()
									}
								}
							}
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

			it("Should work with old delete installation route", () => {
				return supertest(app)
					.delete(`/api/deleteInstallation/${gitHubInstallationId}/${encodeURIComponent(jiraHost)}`)
					.set("host", "127.0.0.1")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("Should work with new delete installation route", () => {
				return supertest(app)
					.delete(`/api/${gitHubInstallationId}/${encodeURIComponent(jiraHost)}`)
					.set("host", "127.0.0.1")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});
		});
	});
});
