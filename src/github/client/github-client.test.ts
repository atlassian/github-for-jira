/* eslint-disable jest/no-standalone-expect */
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "./github-installation-client";
import { getInstallationId } from "./installation-id";
import { HttpsProxyAgent } from "https-proxy-agent";
import "config/env";
import { booleanFlag, BooleanFlags } from "config/feature-flags";
import { mocked } from "ts-jest/utils";
import { when } from "jest-when";
import { GitHubClient } from "~/src/github/client/github-client";
import axios from "axios";

jest.mock("config/feature-flags");

const sleep = (ms): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

function turnOnUseOutboundProxySkiplistFf() {
	when(mocked(booleanFlag)).calledWith(BooleanFlags.USE_OUTBOUND_PROXY_SKIPLIST, false).mockResolvedValue(true);
	new GitHubClient(getLogger("test")); // to update FF value because it is async and the first call will use the old value
	return sleep(0);
}

describe("GitHub Client", () => {
	const githubInstallationId = 17979017;

	beforeEach(() => {
		mocked(booleanFlag).mockResolvedValue(false);
	});

	it("configures the proxy for outbound calls", async () => {
		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), getLogger("test"));
		const outboundProxyConfig = client.getProxyConfig("https://github.com");
		expect(outboundProxyConfig.proxy).toBe(false);
		expect(outboundProxyConfig.httpsAgent).toBeInstanceOf(HttpsProxyAgent);
	});

	it("configures no proxy for calls to the Atlassian network", async () => {
		const client = new GitHubInstallationClient(getInstallationId(githubInstallationId), getLogger("test"));
		const outboundProxyConfig = client.getProxyConfig("http://github.internal.atlassian.com/api");
		expect(outboundProxyConfig.proxy).toBe(false);
		expect(outboundProxyConfig.httpsAgent).toBeUndefined();
	});

	it("sets up httpAgent and httpsAgent using provided proxyBaseUrl value", async () => {
		await turnOnUseOutboundProxySkiplistFf();

		jest.spyOn(axios, "create");
		new GitHubClient(getLogger("test"), "my-github-enterprise.com", "http://myproxy.com:8080");
		const axiosConfig = (axios.create as jest.Mock).mock.calls[0][0];

		expect(axiosConfig.httpAgent.proxy.host).toEqual("myproxy.com");
		expect(axiosConfig.httpsAgent.proxy.host).toEqual("myproxy.com");
	});

	it("does not setup httpAgent and httpsAgent when proxyBaseUrl value is not provided", async () => {
		await turnOnUseOutboundProxySkiplistFf();

		jest.spyOn(axios, "create");
		new GitHubClient(getLogger("test"), "my-github-enterprise.com");
		const axiosConfig = (axios.create as jest.Mock).mock.calls[0][0];

		expect(axiosConfig.httpAgent).toBeUndefined();
		expect(axiosConfig.httpsAgent).toBeUndefined();
	});

});
