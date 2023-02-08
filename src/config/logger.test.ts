import { getLogger } from "config/logger";
import { RingBuffer, Stream } from "bunyan";
import { createHashWithSharedSecret as hash } from "utils/encryption";

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
	});

	describe("logger circular dependencies", () => {
		const logger = getLogger("circular-logger");
		it("should not throw when a circular dependency is passed to logger", () => {
			const data = {
				a: { foo: true },
				b: { bar: "string" }
			};
			data.a = data as any;
			expect(() => logger.warn(data, "log")).not.toThrow();
		});
	});

});
