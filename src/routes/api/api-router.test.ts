/* eslint-disable @typescript-eslint/no-explicit-any */
import supertest from "supertest";
import express, { Application, NextFunction, Request, Response } from "express";
import { Installation, RepoSyncState, Subscription } from "~/src/models";
import InstallationClass from "models/installation";
import SubscriptionClass from "models/subscription";
import { ApiRouter } from "routes/api/api-router";
import { getLogger } from "config/logger";

describe("API Router", () => {
	let app: Application;
	let locals;
	const invalidId = 99999999;
	const gitHubInstallationId = 1234;
	let installation: InstallationClass;
	let subscription: SubscriptionClass;

	const successfulAuthResponseWrite = {
		data: {
			viewer: {
				login: "gimenete",
				organization: {
					viewerCanAdminister: true
				}
			}
		}
	};

	const successfulAuthResponseAdmin = {
		data: {
			viewer: {
				login: "monalisa",
				organization: {
					viewerCanAdminister: true
				}
			}
		}
	};

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
		githubNock
			.post("/graphql")
			.reply(200, {
				data: {
					viewer: {
						login: "monalisa",
						organization: {
							viewerCanAdminister: true
						}
					}
				}
			});

		await supertest(app)
			.get(`/api/${subscription.gitHubInstallationId}/${encodeURIComponent(subscription.jiraHost)}/syncstate`)
			.set("Authorization", "Bearer xxx")
			.then((response) => {
				expect(response.text).toStrictEqual(`{"installationId":${gitHubInstallationId},"jiraHost":"${jiraHost}","numberOfSyncedRepos":0,"repos":{}}`);
			});
	});

	describe("Authentication", () => {
		it("should return 404 if no token is provided", () => {
			return supertest(app)
				.get("/api")
				.expect(404)
				.then((response) => {
					expect(response.body).toMatchSnapshot();
				});
		});

		it("should return 200 if a valid token is provided", () => {
			githubNock
				.post("/graphql")
				.reply(200, successfulAuthResponseWrite);

			return supertest(app)
				.get("/api")
				.set("Authorization", "Bearer xxx")
				.expect(200)
				.then((response) => {
					expect(response.body).toMatchSnapshot();
				});
		});

		it("should return 200 if token belongs to an admin", () => {
			githubNock
				.post("/graphql")
				.reply(200, successfulAuthResponseAdmin);

			return supertest(app)
				.get("/api")
				.set("Authorization", "Bearer xxx")
				.expect(200)
				.then((response) => {
					expect(response.body).toMatchSnapshot();
				});
		});

		it("should return 401 if the GraphQL query returns errors", () => {
			githubNock
				.post("/graphql")
				.reply(200, {
					errors: [
						{
							path: ["query", "viewer", "foo"],
							extensions: {
								code: "undefinedField",
								typeName: "User",
								fieldName: "foo"
							},
							locations: [
								{
									line: 4,
									column: 5
								}
							],
							message: "Field 'foo' doesn't exist on type 'User'"
						}
					]
				});

			return supertest(app)
				.get("/api")
				.set("Authorization", "Bearer xxx")
				.then((response) => {
					expect(response.body).toMatchSnapshot();
					expect(response.status).toEqual(401);
				});
		});

		it("should return 401 if the returned organization is null", () => {
			githubNock
				.post("/graphql")
				.reply(200, {
					data: {
						viewer: {
							login: "gimenete",
							organization: null
						}
					}
				});

			return supertest(app)
				.get("/api")
				.set("Authorization", "Bearer xxx")
				.expect(401)
				.then((response) => {
					expect(response.body).toMatchSnapshot();
				});
		});

		it("should return 401 if the token is invalid", () => {
			githubNock
				.post("/graphql")
				.reply(401, {
					HttpError: {
						message: "Bad credentials",
						documentation_url: "https://developer.github.com/v4"
					}
				});

			return supertest(app)
				.get("/api")
				.set("Authorization", "Bearer bad token")
				.expect(401)
				.then((response) => {
					expect(response.body).toMatchSnapshot();
				});
		});
	});

	describe("Endpoints", () => {

		beforeEach(() => {
			githubNock
				.post("/graphql")
				.reply(200, successfulAuthResponseWrite);
		});

		describe("verify", () => {
			it("should return 'Installation already enabled'", () => {
				jiraNock
					.get("/rest/devinfo/0.10/existsByProperties?fakeProperty=1")
					.reply(200);

				return supertest(app)
					.post(`/api/jira/${installation.id}/verify`)
					.set("Authorization", "Bearer xxx")
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
					.set("Authorization", "Bearer xxx")
					.expect(404)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("should return information for an existing installation", async () => {
				return supertest(app)
					.get(`/api/${gitHubInstallationId}`)
					.set("Authorization", "Bearer xxx")
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
					.set("Authorization", "Bearer xxx")
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
					.set("Authorization", "Bearer xxx")
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
					.set("Authorization", "Bearer xxx")
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
					.set("Authorization", "Bearer xxx")
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
					.set("Authorization", "Bearer xxx")
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
					.set("Authorization", "Bearer xxx")
					.set("host", "127.0.0.1")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("Should work with new delete installation route", () => {
				return supertest(app)
					.delete(`/api/${gitHubInstallationId}/${encodeURIComponent(jiraHost)}`)
					.set("Authorization", "Bearer xxx")
					.set("host", "127.0.0.1")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});
		});
	});
});
