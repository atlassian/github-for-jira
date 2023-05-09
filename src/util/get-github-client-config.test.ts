import { stringFlag, StringFlags } from "config/feature-flags";
import { when } from "jest-when";
import { v4 as newUUID } from "uuid";
import { GitHubServerApp } from "models/github-server-app";
import {
	createAnonymousClient, createAppClient,
	createInstallationClient,
	createUserClient,
	getGitHubClientConfigFromAppId
} from "utils/get-github-client-config";
import { getLogger } from "config/logger";
import { DatabaseStateCreator } from "test/utils/database-state-creator";
import { Subscription } from "models/subscription";

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

	it("includes API key config from FF", async () => {
		when(stringFlag)
			.calledWith(StringFlags.GHE_API_KEY, expect.anything(), jiraHost)
			.mockResolvedValue("[\"ApiKeyHeader\", \"encrypted:super-key\"]");

		const config = await getGitHubClientConfigFromAppId(gitHubServerApp.id, getLogger("test"), jiraHost);
		expect(config.apiKeyConfig!.headerName).toEqual("ApiKeyHeader");
		expect(await config.apiKeyConfig!.apiKeyGenerator()).toEqual("super-key");
	});

	it("includes API key config from Db", async () => {
		gitHubServerApp.apiKeyHeaderName = "ApiKeyHeaderFromDb";
		gitHubServerApp.encryptedApiKeyValue = "encrypted:super-db-key";
		await gitHubServerApp.save();

		const config = await getGitHubClientConfigFromAppId(gitHubServerApp.id, getLogger("test"), jiraHost);
		expect(config.apiKeyConfig!.headerName).toEqual("ApiKeyHeaderFromDb");
		expect(await config.apiKeyConfig!.apiKeyGenerator()).toEqual("super-db-key");
	});

	it("does not include API key config when not provided", async () => {
		const config = await getGitHubClientConfigFromAppId(gitHubServerApp.id, getLogger("test"), jiraHost);
		expect(config.apiKeyConfig).toBeUndefined();
	});

	describe("anonymous client", () => {
		it("works fine without apiKeyConfig", async () => {
			gheNock.get("/").reply(200);
			const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));
			const response = await client.getPage(1000);
			expect(response.status).toStrictEqual(200);
		});

		it("uses provided API key config", async () => {
			gheNock.get("/").matchHeader("foo", "bar").reply(200);
			const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"), {
				headerName: "foo",
				apiKeyGenerator: () => Promise.resolve("bar")
			});
			const response = await client.getPage(1000);
			expect(response.status).toStrictEqual(200);
		});
	});
});

describe("anonymous client", () => {
	beforeEach(async () => {
		await new DatabaseStateCreator().forServer().create();
	});

	it("should inject API key when provided", async () => {
		when(stringFlag)
			.calledWith(StringFlags.GHE_API_KEY, expect.anything(), jiraHost)
			.mockResolvedValue("[\"ApiKeyHeader\", \"encrypted:super-key\"]");

		gheNock.get("/")
			.matchHeader("ApiKeyHeader", "super-key")
			.reply(200);
		const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));
		const response = await client.getPage(1000);
		expect(response).toBeDefined();
	});
})
;

describe("user client", () => {
	let gitHubServerApp: GitHubServerApp | null | undefined = undefined;
	beforeEach(async () => {
		const res = await new DatabaseStateCreator().forServer().create();
		gitHubServerApp = res.gitHubServerApp;
	});

	it("should inject API key when provided", async () => {
		when(stringFlag)
			.calledWith(StringFlags.GHE_API_KEY, expect.anything(), jiraHost)
			.mockResolvedValue("[\"ApiKeyHeader\", \"encrypted:super-key\"]");

		gheApiNock.get("/user")
			.matchHeader("ApiKeyHeader", "super-key")
			.reply(200);
		const client = await createUserClient("MY_TOKEN", jiraHost, { trigger: "test" }, getLogger("test"), gitHubServerApp?.id);
		const response = await client.getUser();
		expect(response).toBeDefined();
	});
});

describe("installation client", () => {
	let gitHubServerApp: GitHubServerApp | null | undefined = undefined;
	let subscription: Subscription | null | undefined = undefined;
	beforeEach(async () => {
		const res = await new DatabaseStateCreator().forServer().create();
		gitHubServerApp = res.gitHubServerApp;
		subscription = res.subscription;
	});

	it("should inject API key when provided", async () => {
		when(stringFlag)
			.calledWith(StringFlags.GHE_API_KEY, expect.anything(), jiraHost)
			.mockResolvedValue("[\"ApiKeyHeader\", \"encrypted:super-key\"]");

		gheUserTokenNock(subscription!.gitHubInstallationId)
			.matchHeader("ApiKeyHeader", "super-key");

		gheApiNock.get("/rate_limit")
			.matchHeader("ApiKeyHeader", "super-key")
			.reply(200);
		const client = await createInstallationClient(subscription!.gitHubInstallationId, jiraHost, { trigger: "test" }, getLogger("test"), gitHubServerApp?.id);
		const response = await client.getRateLimit();
		expect(response).toBeDefined();
	});
});

describe("app client", () => {
	let gitHubServerApp: GitHubServerApp | null | undefined = undefined;
	beforeEach(async () => {
		const res = await new DatabaseStateCreator().forServer().create();
		gitHubServerApp = res.gitHubServerApp;
	});

	it("should inject API key when provided", async () => {
		when(stringFlag)
			.calledWith(StringFlags.GHE_API_KEY, expect.anything(), jiraHost)
			.mockResolvedValue("[\"ApiKeyHeader\", \"encrypted:super-key\"]");

		gheAppTokenNock()
			.matchHeader("ApiKeyHeader", "super-key");

		const client = await createAppClient(getLogger("test"), jiraHost, gitHubServerApp?.id, { trigger: "test" });
		const response = await client.getApp();
		expect(response).toBeDefined();
	});
});
