/* eslint-disable jest/no-standalone-expect */
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "./github-installation-client";
import { getInstallationId } from "./installation-id";
import { HttpsProxyAgent } from "https-proxy-agent";
import "config/env";

jest.mock("config/feature-flags");

describe("GitHub Client", () => {
	const githubInstallationId = 17979017;

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

});
