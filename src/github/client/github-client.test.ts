/* eslint-disable jest/no-standalone-expect */
import "config/env";

import * as axios from "axios";
import { GitHubClient, GitHubConfig } from "~/src/github/client/github-client";
import { getLogger } from "config/logger";

jest.mock("axios");

class TestGitHubClient extends GitHubClient {
	constructor(config: GitHubConfig) {
		super(config, jiraHost, { trigger: "test" }, getLogger("test"));
	}
	public doTestGraphqlCall() {
		return this.graphql("foo", {});
	}
}

describe("GitHub Client (mocks)", () => {
	const mockedAxiosPost = jest.fn();

	beforeEach(async () => {
		const mockedAxiosCreate = {
			interceptors: {
				request: {
					use: jest.fn()
				},
				response: {
					use: jest.fn()
				}
			},
			post: mockedAxiosPost
		};
		(axios.default.create as jest.Mock).mockReturnValue(mockedAxiosCreate);
		mockedAxiosPost.mockReset();
		mockedAxiosPost.mockResolvedValue({});
	});

	it("uses proxy when provided", async () => {
		new TestGitHubClient({
			... gitHubCloudConfig,
			proxyBaseUrl: "http://proxy.com"
		});
		const calls = (axios.default.create as jest.Mock).mock.calls[0];
		expect(calls[0].proxy).toBeFalsy();
		expect(calls[0].httpAgent.proxy.host).toEqual("proxy.com");
		expect(calls[0].httpsAgent.proxy.host).toEqual("proxy.com");
	});

	describe("config object", () => {
		const TEST_API_URL = "http://api.myBaseUrl.com";
		const TEST_GRAPHQL_URL = "http://graphql.myBaseUrl.com";

		const TEST_GITHUB_CONFIG = {
			hostname: "myHostname",
			baseUrl: "http://myBaseUrl.com",
			apiUrl: TEST_API_URL,
			graphqlUrl: TEST_GRAPHQL_URL
		};

		it("gitHubConfig.apiUrl is used", async () => {
			new TestGitHubClient(TEST_GITHUB_CONFIG);
			const calls = (axios.default.create as jest.Mock).mock.calls[0];
			expect(calls[0].baseURL).toEqual(TEST_API_URL);
		});

		it("gitHubConfig.graphqlUrl is used", async () => {
			const client = new TestGitHubClient(TEST_GITHUB_CONFIG);
			await client.doTestGraphqlCall();
			expect(mockedAxiosPost.mock.calls[0][0]).toEqual(TEST_GRAPHQL_URL);
		});

	});
});
