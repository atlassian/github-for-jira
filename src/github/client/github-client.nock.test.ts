/* eslint-disable jest/no-standalone-expect */
import "config/env";

import { GitHubClient, GitHubConfig } from "~/src/github/client/github-client";

class TestGitHubClient extends GitHubClient {
	constructor(config: GitHubConfig) {
		super(config);
	}
	public doTestHttpCall() {
		return this.axios.get("/", {});
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

});
