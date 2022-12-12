import { stringFlag, StringFlags } from "config/feature-flags";
import { when } from "jest-when";
import { v4 as newUUID } from "uuid";
import { GitHubServerApp } from "models/github-server-app";
import { getGitHubClientConfigFromAppId } from "utils/get-github-client-config";
import { getLogger } from "config/logger";

jest.mock("../config/feature-flags");

describe("get-github-client-config", () => {
	const uuid = newUUID();
	const APP_ID = 123;
	const GHES_HOSTNAME = "myinternalserver.com:8090";
	let gitHubServerApp: GitHubServerApp;
	beforeEach(async () => {
		const payload = {
			uuid: uuid,
			appId: APP_ID,
			gitHubAppName: "My GitHub Server App",
			gitHubBaseUrl: "http://" + GHES_HOSTNAME,
			gitHubClientId: "lvl.1234",
			gitHubClientSecret: "myghsecret",
			webhookSecret: "mywebhooksecret",
			privateKey: "myprivatekey",
			installationId: 10
		};

		gitHubServerApp = await GitHubServerApp.install(payload, jiraHost);

	});

	afterEach(async () => {
		await GitHubServerApp.uninstallApp(uuid);
	});

	it("skips proxy if GHES hostname is in the skiplist", async () => {
		when(stringFlag)
			.calledWith(StringFlags.OUTBOUND_PROXY_SKIPLIST, expect.anything(), jiraHost)
			.mockResolvedValue(GHES_HOSTNAME);

		const config = await getGitHubClientConfigFromAppId(gitHubServerApp.id, getLogger("test"), jiraHost);
		expect(config.proxyBaseUrl).toBeUndefined();
	});

	it("skips proxy if GHES hostname is in the skiplist without port", async () => {
		when(stringFlag)
			.calledWith(StringFlags.OUTBOUND_PROXY_SKIPLIST, expect.anything(), jiraHost)
			.mockResolvedValue(new URL("http://" + GHES_HOSTNAME).hostname);

		const config = await getGitHubClientConfigFromAppId(gitHubServerApp.id, getLogger("test"), jiraHost);
		expect(config.proxyBaseUrl).toBeUndefined();
	});

	it("skips proxy if GHES URL is in the skiplist", async () => {
		when(stringFlag)
			.calledWith(StringFlags.OUTBOUND_PROXY_SKIPLIST, expect.anything(), jiraHost)
			.mockResolvedValue("http://" + GHES_HOSTNAME);

		const config = await getGitHubClientConfigFromAppId(gitHubServerApp.id, getLogger("test"), jiraHost);
		expect(config.proxyBaseUrl).toBeUndefined();
	});

	it("does not skip proxy if GHES hostname is not in the skiplist", async () => {
		when(stringFlag)
			.calledWith(StringFlags.OUTBOUND_PROXY_SKIPLIST, expect.anything(), jiraHost)
			.mockResolvedValue("some-other-instance.com");

		const config = await getGitHubClientConfigFromAppId(gitHubServerApp.id, getLogger("test"), jiraHost);
		expect(config.proxyBaseUrl).toEqual("http://proxy:8080");
	});

	it("never skips proxy for GitHub cloud, even if the hostname is in the skiplist", async () => {
		when(stringFlag)
			.calledWith(StringFlags.OUTBOUND_PROXY_SKIPLIST, expect.anything(), jiraHost)
			.mockResolvedValue("github.com,api.github.com");

		const config = await getGitHubClientConfigFromAppId(undefined, getLogger("test"), jiraHost);
		expect(config.proxyBaseUrl).toEqual("http://proxy:8080");
	});
});
