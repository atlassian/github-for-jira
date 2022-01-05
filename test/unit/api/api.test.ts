/* eslint-disable @typescript-eslint/no-explicit-any */
import supertest from "supertest";
import express, { Application, NextFunction, Request, Response } from "express";
import { Installation, RepoSyncState, Subscription } from "../../../src/models";
import InstallationClass from "../../../src/models/installation";
import SubscriptionClass from "../../../src/models/subscription";
import api from "../../../src/api";
import { getLogger } from "../../../src/config/logger";
import getAxiosInstance from "../../../src/jira/client/axios";
import { booleanFlag, BooleanFlags } from "../../../src/config/feature-flags";
import { when } from "jest-when";
import { mocked } from "ts-jest/utils";

jest.mock("../../../src/config/feature-flags");
jest.mock("../../../src/jira/client/axios");

describe("API", () => {
	let app: Application;
	let locals;
	const invalidId = 99999999;
	const gitHubInstallationId = 1234;
	let installation:InstallationClass;
	let subscription:SubscriptionClass;

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

	const createApp = async () => {
		const app = express();
		app.use((req: Request, res: Response, next: NextFunction) => {
			res.locals = locals || {};
			req.log = getLogger("test");
			req.session = { jiraHost };
			next();
		});
		app.use("/api", api);
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
		app = await createApp();

		installation = await Installation.create({
			gitHubInstallationId,
			jiraHost,
			sharedSecret: "secret",
			clientKey: "client-key"
		});

		subscription = await Subscription.create({
			gitHubInstallationId,
			jiraHost,
			jiraClientKey: "client-key",
			repoSyncState: {
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
				}
			}
		});
	});

	afterEach(async () => {
		await Installation.destroy({truncate: true});
		await Subscription.destroy({truncate: true});
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
		function mockJiraResponse(status: number) {
			// eslint-disable-next-line @typescript-eslint/ban-ts-comment
			// @ts-ignore
			mocked(getAxiosInstance).mockReturnValue({
				"get": () => Promise.resolve<any>({
					status
				})
			});
		}

		describe("verify", () => {
			beforeEach(async () => {
				mockJiraResponse(200);
			});

			it("should return 'Installation already enabled'", () => {
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

		beforeEach(() => {
			githubNock
				.post("/graphql")
				.reply(200, successfulAuthResponseWrite);
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
					.send(`jiraHost=${jiraHost}`)
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});
		});

		describe("repoSyncState", () => {
			it("should return 404 if no installation is found", async () => {
				return supertest(app)
					.get(`/api/${invalidId}/repoSyncState.json`)
					.set("Authorization", "Bearer xxx")
					.set("host", "127.0.0.1")
					.send(`jiraHost=${jiraHost}`)
					.expect(404)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			it("should return the repoSyncState information for an existing installation", async () => {
				return supertest(app)
					.get(`/api/${gitHubInstallationId}/${encodeURIComponent(jiraHost)}/repoSyncState.json`)
					.set("Authorization", "Bearer xxx")
					.set("host", "127.0.0.1")
					.expect(200)
					.then((response) => {
						expect(response.body).toMatchSnapshot();
					});
			});

			describe("RepoSyncState as Source", () => {
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

				afterEach(async () => {
					await RepoSyncState.destroy({truncate: true});
				});

				it("should return the repoSyncState information for an existing installation", async () => {
					when(booleanFlag).calledWith(
						BooleanFlags.REPO_SYNC_STATE_AS_SOURCE,
						expect.anything()
					).mockResolvedValue(true);

					return supertest(app)
						.get(`/api/${gitHubInstallationId}/${encodeURIComponent(jiraHost)}/repoSyncState.json`)
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
									},
								}
							});
						});
				});
			});
		});

		describe("sync", () => {
			it("should return 404 if no installation is found", async () => {
				return supertest(app)
					.post(`/api/${invalidId}/sync`)
					.set("Authorization", "Bearer xxx")
					.send("jiraHost=https://unknownhost.atlassian.net")
					.expect(404)
					.then((response) => {
						expect(response.text).toMatchSnapshot();
					});
			});

			it("should trigger the sync or start function", async () => {
				return supertest(app)
					.post(`/api/${gitHubInstallationId}/sync`)
					.set("Authorization", "Bearer xxx")
					.set("host", "127.0.0.1")
					.send(`jiraHost=${jiraHost}`)
					.expect(202)
					.then((response) => {
						expect(response.text).toMatchSnapshot();
					});
			});

			it("should reset repoSyncState if asked to", async () => {
				return supertest(app)
					.post(`/api/${gitHubInstallationId}/sync`)
					.set("Authorization", "Bearer xxx")
					.set("host", "127.0.0.1")
					.send(`jiraHost=${jiraHost}`)
					.send("resetType=full")
					.expect(202)
					.then((response) => {
						expect(response.text).toMatchSnapshot();
						// td.verify(Subscription.findOrStartSync(subscription, "full"));
					});
			});
		});
	});
});
