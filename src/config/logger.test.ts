import { getLogger } from "config/logger";
import { RingBuffer, Stream } from "bunyan";
import { createHashWithSharedSecret as hash } from "utils/encryption";
import { GithubClientGraphQLError } from "~/src/github/client/github-client-errors";
import { createAnonymousClient } from "utils/get-github-client-config";
import { noop } from "lodash";
import { TaskError } from "~/src/sync/installation";
import { AxiosResponse } from "axios";

describe("logger behaviour", () => {

	describe("error logger", () => {
		let ringBuffer: RingBuffer;

		beforeEach(() => {
			ringBuffer = new RingBuffer({ limit: 5 });
		});

		it("should log error messages", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({ err: new Error("boom!") });

			expect(JSON.parse(ringBuffer.records[0]).err.message).toEqual("boom!");
		});
	});

	describe("safe logger", () => {
		let ringBuffer: RingBuffer;

		beforeEach(() => {
			ringBuffer = new RingBuffer({ limit: 5 });
		});

		it("should write out logging action text to msg stream", () => {
			const logger = getLogger("name");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.info("Greetings");

			expect(JSON.parse(ringBuffer.records[0]).msg).toEqual("Greetings");
		});

		it("should keep parent fields on new child logger", () => {
			const logger = getLogger("name", { fields: { foo: "bar" } });
			const childLogger = logger.child({ bingo: "buzz" });
			logger.warn("Greetings");

			expect(childLogger.fields.foo).toBe("bar");
			expect(childLogger.fields.bingo).toBe("buzz");
		});

		it("Should write all logging methods to msg stream", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.warn("Warning");
			logger.info("Info");
			logger.error("Error");
			logger.fatal("FATALALITY");

			expect(JSON.parse(ringBuffer.records[0]).msg).toEqual("Warning");
			expect(JSON.parse(ringBuffer.records[1]).msg).toEqual("Info");
			expect(JSON.parse(ringBuffer.records[2]).msg).toEqual("Error");
			expect(JSON.parse(ringBuffer.records[3]).msg).toEqual("FATALALITY");
		});

		const TEST_BRANCH_NAME = "blah-with/some-= crazy? shit";
		const TEST_USER = "some Crazy Us?e#r";
		const TEST_ORG_NAME = "testOrg";
		const TEST_REPO_NAME = "testRepo";

		it("Should remove authorization header", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				config: {
					headers: {
						Accept: "application/vnd.github.v3+json",
						Authorization: "token super-secret",
						"User-Agent": "axios/0.26.0"
					}
				},
				request: {
					headers: {
						Accept: "application/vnd.github.v3+json",
						Authorization: "token super-secret",
						"User-Agent": "axios/0.26.0"
					}
				},
				response: {
					headers: {
						Accept: "application/vnd.github.v3+json",
						Authorization: "token super-secret",
						"User-Agent": "axios/0.26.0"
					}
				}
			});

			expect(JSON.parse(ringBuffer.records[0]).config.headers.authorization).toEqual("CENSORED");
			expect(JSON.parse(ringBuffer.records[0]).request.headers.authorization).toEqual("CENSORED");
			expect(JSON.parse(ringBuffer.records[0]).response.headers.authorization).toEqual("CENSORED");
		});

		it("Should remove cookies header", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				config: {
					headers: {
						Accept: "application/vnd.github.v3+json",
						Cookie: "super-secret",
						"User-Agent": "axios/0.26.0"
					}
				},
				req: {
					headers: {
						Accept: "application/vnd.github.v3+json",
						Cookie: "super-secret",
						"User-Agent": "axios/0.26.0"
					}
				},
				res: {
					headers: {
						Accept: "application/vnd.github.v3+json",
						"Set-cookie": "token super-secret",
						"User-Agent": "axios/0.26.0"
					}
				}
			});

			expect(JSON.parse(ringBuffer.records[0]).config.headers.cookie).toEqual("CENSORED");
			expect(JSON.parse(ringBuffer.records[0]).req.headers.cookie).toEqual("CENSORED");
			expect(JSON.parse(ringBuffer.records[0]).res.headers["set-cookie"]).toEqual("CENSORED");
		});

		it("should remove UGC from tasks", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				task: {
					cursor: 18,
					repository: {
						full_name: "raise-of-machines/top-secret",
						html_url: "https://github.com/top-secret",
						id: 123456,
						name: "top-secret",
						owner: {
							login: "raise-of-machines"
						},
						updated_at: new Date("2022-01-01T19:59:53.000Z")
					},
					repositoryId: 54321,
					task: "pull"
				}
			});
			expect(JSON.parse(ringBuffer.records[0]).task).toEqual(
				{
					"cursor": 18,
					"repository": {
						"fullName": hash("raise-of-machines/top-secret"),
						"id": 123456,
						"name": hash("top-secret"),
						"owner": {
							"login": hash("raise-of-machines")
						},
						"updatedAt": "2022-01-01T19:59:53.000Z"
					},
					"repositoryId": 54321,
					"task": "pull"
				}
			);
		});

		it("should remove UGC from tasks error", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error(
				{ err: new TaskError({
					cursor: "18",
					repository: {
						full_name: "raise-of-machines/top-secret",
						html_url: "https://github.com/top-secret",
						id: 123456,
						name: "top-secret",
						owner: {
							login: "raise-of-machines"
						},
						updated_at: "2022-01-01T19:59:53.000Z"
					},
					repositoryId: 54321,
					task: "pull"
				}, new Error("boom")) }, "surprise!");

			expect(JSON.parse(ringBuffer.records[0]).err.task).toEqual(
				{
					"cursor": "18",
					"repository": {
						"fullName": hash("raise-of-machines/top-secret"),
						"id": 123456,
						"name": hash("top-secret"),
						"owner": {
							"login": hash("raise-of-machines")
						},
						"updatedAt": "2022-01-01T19:59:53.000Z"
					},
					"repositoryId": 54321,
					"task": "pull"
				}
			);
		});

		it("should remove repo name from error message", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error(
				{
					err: new GithubClientGraphQLError({} as unknown as AxiosResponse, [
						{
							type: "SOME_OTHER_ERROR",
							path: ["repository"],
							locations: [
								{
									line: 7,
									column: 3
								}
							],
							message:
								"Could not resolve to a Repository with the name 'some-org/some-repo'."
						}
					])
				}, "surprise!");

			expect(JSON.parse(ringBuffer.records[0]).err).toEqual(
				{
					cause: {
						isAxiosError: true,
						message: "GraphQLError(s)",
						name: "GraphQLError",
						response: { }
					},
					uiErrorCode: "UNKNOWN",
					errors: [
						{
							locations: [
								{
									column: 3,
									line: 7
								}
							],
							message: `Could not resolve to a Repository with the name '${hash("some-org")}/${hash("some-repo")}'.`,
							path: [
								"repository"
							],
							type: "SOME_OTHER_ERROR"
						}
					],
					isRetryable: false,
					message: `Could not resolve to a Repository with the name '${hash("some-org")}/${hash("some-repo")}'.`,
					stack: expect.anything()
				}
			);
		});

		it("should log stacktrace", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });

			const theThrowingFunction = () => {
				throw new Error("foo");
			};

			let err: Error;
			try {
				theThrowingFunction();
			} catch (caught) {
				err = caught;
			}
			logger.error({ err: err! }, "surprise!");

			expect(JSON.parse(ringBuffer.records[0]).err.stack).toContain("theThrowingFunction");
		});

		it("Should remove branch from URL", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				config: {
					url: `/rest/devinfo/0.10/repository/448757705/branch/${encodeURIComponent(TEST_BRANCH_NAME)}?_updateSequenceId=1663617601470`
				}
			});

			expect(JSON.parse(ringBuffer.records[0]).config.url).toEqual(
				`/rest/devinfo/0.10/repository/448757705/branch/${hash(TEST_BRANCH_NAME)}?_updateSequenceId=1663617601470`
			);
		});

		it("Should remove repo search query from URL", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: "/search/repositories?q=d%20org%bgvozdev%20org%3Addi-test%20in%3Aname&order=updated"
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual("/search/repositories?q=CENSORED&order=updated");
		});

		it("Should sanitise relative URLs", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `users/${encodeURIComponent(TEST_USER)}`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`users/${hash(TEST_USER)}`);
		});

		it("Should remove user from URL", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/users/${encodeURIComponent(TEST_USER)}`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/users/${hash(TEST_USER)}`);
		});

		it("Should remove user from URL (v3)", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/api/v3/users/${encodeURIComponent(TEST_USER)}`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/api/v3/users/${hash(TEST_USER)}`);
		});

		it("Should branch names from compare URL (v3)", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/api/v3/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/compare/${TEST_BRANCH_NAME}...${TEST_BRANCH_NAME + "2"}`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/api/v3/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/` +
					`compare/${hash(TEST_BRANCH_NAME)}...${hash(TEST_BRANCH_NAME + "2")}`);
		});

		it("Should branch names from compare URL", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/compare/${TEST_BRANCH_NAME}...${TEST_BRANCH_NAME + "2"}`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/` +
				`compare/${hash(TEST_BRANCH_NAME)}...${hash(TEST_BRANCH_NAME + "2")}`);
		});

		it("Should remove git ref from URL (v3)", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/api/v3/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/git/ref/${encodeURIComponent(TEST_BRANCH_NAME)}`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/api/v3/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/git/ref/${hash(TEST_BRANCH_NAME)}`
			);
		});

		it("Should remove git ref from URL", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/git/ref/${encodeURIComponent(TEST_BRANCH_NAME)}`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/git/ref/${hash(TEST_BRANCH_NAME)}`
			);
		});

		it("Should remove repo from URL to pull request reviews (v3)", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/api/v3/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/pulls/100/reviews`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/api/v3/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/pulls/100/reviews`
			);
		});

		it("Should remove repo from URL to pull request reviews", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/pulls/100/reviews`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/pulls/100/reviews`
			);
		});

		it("Should remove repo from URL to commit (v3)", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/api/v3/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/commits/123321`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/api/v3/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/commits/123321`
			);
		});

		it("Should remove repo from URL to commit", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/commits/123321`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/commits/123321`
			);
		});

		it("Should remove repo from URL to jira config (v3)", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/api/v3/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/contents/.jira/config.yml`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/api/v3/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/contents/.jira/config.yml`
			);
		});

		it("Should remove repo from URL to jira config", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				requestPath: `/repos/${TEST_ORG_NAME}/${TEST_REPO_NAME}/contents/.jira/config.yml`
			});

			expect(JSON.parse(ringBuffer.records[0]).requestPath).toEqual(
				`/repos/${hash(TEST_ORG_NAME)}/${hash(TEST_REPO_NAME)}/contents/.jira/config.yml`
			);
		});

		it("Should remove owners and repos from create-branch/branches URL", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				req: {
					path: "/owners/OWNERS/repos/REPOS/branches",
					url: "/github/create-branch/owners/OWNERS/repos/REPOS/branches?asd=qwe"
				}
			});

			expect(JSON.parse(ringBuffer.records[0]).req.path).toEqual(
				`/owners/${hash("OWNERS")}/repos/${hash("REPOS")}/branches`);
			expect(JSON.parse(ringBuffer.records[0]).req.url).toEqual(
				`/github/create-branch/owners/${hash("OWNERS")}/repos/${hash("REPOS")}/branches?asd=qwe`);
		});

		it("Should remove jiraHost from query params", () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });
			logger.error({
				req: {
					path: "/mypath?jiraHost=https%3A%2F%2Fsupersecretjira.atlassian.net"
				}
			});

			expect(JSON.parse(ringBuffer.records[0]).req.path).toEqual(
				`/mypath?jiraHost=` + hash("https://supersecretjira.atlassian.net"));
		});
	});

	describe("logger circular dependencies", () => {
		const logger = getLogger("circular-logger");
		it("should not throw when a circular dependency is passed to logger", () => {
			const data = {
				a: { foo: true },
				b: { bar: "string" }
			};
			data.a = data as any;
			expect(() => { logger.warn(data, "log"); }).not.toThrow();
		});
	});

	describe("logging errors", () => {

		let ringBuffer: RingBuffer;

		beforeEach(() => {
			ringBuffer = new RingBuffer({ limit: 50 });
		});

		it("should log GraphQL errors", async () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });

			gheNock.get("/")
				.reply(200, {}, { "foo": "bar" });

			const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));

			const response = await client.getPage(1000);

			logger.error({
				err: new GithubClientGraphQLError(
					response,
					[
						{
							message: "blah1",
							type: "type1"
						},
						{
							message: "blah2",
							type: "type2"
						}
					])
			});

			const record = JSON.parse(ringBuffer.records[0]);

			expect(record.err).toMatchObject({
				isRetryable: false,
				status: 200,
				cause: {
					name: "GraphQLError",
					message: "GraphQLError(s)",
					response: {
						status: 200,
						statusText: null,
						headers: {
							foo: "CENSORED",
							"content-type": "application/json"
						}
					},
					request: {
						method: "GET",
						path: "/",
						headers: {
							accept: "application/json, text/plain, */*",
							"user-agent": "axios/0.26.0",
							host: "github.mydomain.com"
						}
					},
					isAxiosError: true
				},
				errors: [
					{
						message: "blah1",
						type: "type1"
					},
					{
						message: "blah2",
						type: "type2"
					}
				],
				message: "blah1 and 1 more errors"
			});
			expect(record.err.cause.request.remoteAddress).toBeDefined();
			expect(record.err.cause.request.remotePort).toBeDefined();
		});

		it("should log RateLimiting errors with all headers", async () => {
			const logger = getLogger("test case");
			logger.addStream({ stream: ringBuffer as Stream });

			gheNock.get("/")
				.reply(403, {
					message: "API rate limit exceeded",
					documentation_url: "https://docs.github.com/rest/overview/resources-in-the-rest-api#rate-limiting"
				}, {
					"X-RateLimit-Limit": "60",
					"X-RateLimit-Remaining": "0",
					"X-RateLimit-Reset": "1613088454"
				});

			const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, logger);

			await client.getPage(1000).catch(noop);

			const record = JSON.parse(ringBuffer.records[ringBuffer.records.length - 1]);

			expect(record.err).toMatchObject({
				isRetryable: false,
				status: 403,
				cause: {
					request: {
						method: "GET",
						path: "/",
						headers: {
							accept: "application/json, text/plain, */*",
							"user-agent": "axios/0.26.0",
							host: "github.mydomain.com"
						}
					},
					response: {
						status: 403,
						statusText: null,
						headers: {
							"x-ratelimit-limit": "60",
							"x-ratelimit-remaining": "0",
							"x-ratelimit-reset": "1613088454",
							"content-type": "application/json"
						}
					},
					isAxiosError: true
				},
				rateLimitReset: 1613088454,
				message: "Rate limiting error"
			});
			expect(record.err.cause.request.remoteAddress).toBeDefined();
			expect(record.err.cause.request.remotePort).toBeDefined();
		});
	});

});
