/* eslint-disable jest/no-standalone-expect */
import { HttpsProxyAgent } from "https-proxy-agent";
import "config/env";

import * as axios from "axios";
import { GitHubClient, GitHubConfig } from "~/src/github/client/github-client";

jest.mock("axios");

jest.mock("config/feature-flags");

class TestGitHubClient extends GitHubClient {
	constructor(config?: GitHubConfig) {
		super(config);
	}
	public doTestGraphqlCall() {
		return this.graphql("foo", {});
	}
}

const TEST_API_URL = 'http://api.myBaseUrl.com';
const TEST_GRAPHQL_URL = 'http://graphql.myBaseUrl.com';

const TEST_GITHUB_CONFIG = {
	hostname: 'myHostname',
	baseUrl: 'http://myBaseUrl.com',
	apiUrl: TEST_API_URL,
	graphqlUrl: TEST_GRAPHQL_URL
};

describe("GitHub Client", () => {

	const mockedAxiosPost = jest.fn();

	beforeEach(() => {
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

	it("configures the proxy for outbound calls", async () => {
		const client = new TestGitHubClient(undefined);
		const outboundProxyConfig = client.getProxyConfig("https://github.com");
		expect(outboundProxyConfig.proxy).toBe(false);
		expect(outboundProxyConfig.httpsAgent).toBeInstanceOf(HttpsProxyAgent);
	});

	it("configures no proxy for calls to the Atlassian network", async () => {
		const client = new TestGitHubClient();
		const outboundProxyConfig = client.getProxyConfig("http://github.internal.atlassian.com/api");
		expect(outboundProxyConfig.proxy).toBe(false);
		expect(outboundProxyConfig.httpsAgent).toBeUndefined();
	});

	it("uses gitHubConfig.apiUrl, if provided", async () => {
		new TestGitHubClient(TEST_GITHUB_CONFIG);
		const calls = (axios.default.create as jest.Mock).mock.calls[0];
		expect(calls[0].baseURL).toEqual(TEST_API_URL);
	});

	it("uses gitHubConfig.graphqlUrl, if provided", async () => {
		const client = new TestGitHubClient(TEST_GITHUB_CONFIG);
		await client.doTestGraphqlCall();
		expect(mockedAxiosPost.mock.calls[0][0]).toEqual(TEST_GRAPHQL_URL);
	});

});
