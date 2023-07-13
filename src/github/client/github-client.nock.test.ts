/* eslint-disable jest/no-standalone-expect */
import "config/env";

import { GitHubClient, GitHubConfig } from "~/src/github/client/github-client";
import { getLogger } from "config/logger";
import {
	GithubClientInvalidPermissionsError,
	GithubClientRateLimitingError, GithubClientNotFoundError
} from "~/src/github/client/github-client-errors";

class TestGitHubClient extends GitHubClient {
	constructor(config: GitHubConfig) {
		super(config, jiraHost, { trigger: "test" }, getLogger("test"));
	}
	public doTestHttpCall() {
		return this.axios.get("/", {});
	}
	public doTestGraphqlCall() {
		return this.graphql("foo", {});
	}
}

describe("GitHub Client (nock)", () => {

	it("injects API key when provided", async () => {
		githubNock.get("/")
			.matchHeader("MyHeader", "supersecret")
			.reply(200);
		const response = await new TestGitHubClient({
			... gitHubCloudConfig,
			apiKeyConfig: {
				headerName: "MyHeader",
				apiKeyGenerator: () => Promise.resolve("supersecret")
			}
		}).doTestHttpCall();
		expect(response).toBeDefined();
	});

	it("does not explode when no API key was provided", async () => {
		githubNock.get("/")
			.reply(200);
		const response = await new TestGitHubClient(gitHubCloudConfig).doTestHttpCall();
		expect(response).toBeDefined();
	});

	describe("graphql mapping",  () => {
		it("maps RATE_LIMIT graphQL error to RateLimitingError", async () => {
			githubNock.post("/graphql").reply(200, {
				data: null,
				errors: [
					{
						type: "RATE_LIMITED",
						path: [
							"query"
						],
						locations: [
							{
								line: 1,
								column: 1
							}
						],
						message: "API rate limit exceeded. You can make 5000 requests per hour. Your remaining requests are 0."
					}
				]
			});

			let err: Error;
			try {
				await new TestGitHubClient(gitHubCloudConfig).doTestGraphqlCall();
			} catch (caught) {
				err = caught;
			}
			expect(err!).toBeInstanceOf(GithubClientRateLimitingError);
		});

		it("maps FORBIDDEN graphQL error to InvalidPermissionsError", async () => {
			githubNock.post("/graphql").reply(200, {
				data: null,
				errors: [
					{
						type: "FORBIDDEN",
						path: [
							"query"
						],
						locations: [
							{
								line: 1,
								column: 1
							}
						],
						message: "Resource not accessible by integration"
					}
				]
			});

			let err: Error;
			try {
				await new TestGitHubClient(gitHubCloudConfig).doTestGraphqlCall();
			} catch (caught) {
				err = caught;
			}
			expect(err!).toBeInstanceOf(GithubClientInvalidPermissionsError);
		});

		it("maps NOT_FOUND to 404", async () => {
			githubNock.post("/graphql").reply(200, {
				data: null,
				errors: [
					{
						type: "NOT_FOUND",
						path: [
							"query"
						],
						locations: [
							{
								line: 1,
								column: 1
							}
						],
						message: "Repository was deleted"
					}
				]
			});

			let err: Error;
			try {
				await new TestGitHubClient(gitHubCloudConfig).doTestGraphqlCall();
			} catch (caught) {
				err = caught;
			}
			expect(err!).toBeInstanceOf(GithubClientNotFoundError);
		});
	});

});
