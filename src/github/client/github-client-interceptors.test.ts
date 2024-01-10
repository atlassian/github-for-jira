import { createAnonymousClient } from "utils/get-github-client-config";
import { getLogger } from "config/logger";
import {
	GithubClientBlockedIpError,
	GithubClientInvalidPermissionsError,
	GithubClientNotFoundError,
	GithubClientSSOLoginError,
	GithubClientCommitNotFoundBySHAError
} from "~/src/github/client/github-client-errors";

describe("github-client-interceptors", () => {
	it("correctly maps invalid permission error", async () => {
		gheNock.get("/").reply(403, {
			"message": "Resource not accessible by integration",
			"documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#authentication"
		});

		let error: Error;
		const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));
		try {
			await client.getPage(1000);
		} catch (err: unknown) {
			error = err as Error;
		}
		expect(error!).toBeInstanceOf(GithubClientInvalidPermissionsError);
	});

	it("correctly maps 404 to not found", async () => {
		gheNock.get("/").reply(404, {
			"message": "Resource not found",
			"documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#authentication"
		});

		let error: Error;
		const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));
		try {
			await client.getPage(1000);
		} catch (err: unknown) {
			error = err as Error;
		}
		expect(error!).toBeInstanceOf(GithubClientNotFoundError);
	});

	it("correctly maps blocked ip error", async () => {
		gheNock.get("/").reply(403, {
			"message": "blablabla has an IP allow list enabled"
		});

		let error: Error;
		const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));
		try {
			await client.getPage(1000);
		} catch (err: unknown) {
			error = err as Error;
		}
		expect(error!).toBeInstanceOf(GithubClientBlockedIpError);
	});

	it("correctly maps sso login error", async () => {
		gheNock.get("/").reply(403, undefined, { "x-github-sso": "abcdef" });

		let error: Error;
		const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));
		try {
			await client.getPage(1000);
		} catch (err: unknown) {
			error = err as Error;
		}
		expect(error!).toBeInstanceOf(GithubClientSSOLoginError);
	});

	it("correctly maps commits not found by sha error", async () => {
		gheNock.get("/").reply(422, {
			"message": "No commit found for SHA: whatever the sha is",
			"documentation_url": "https://docs.github.com"
		});

		let error: Error;
		const client = await createAnonymousClient(gheUrl, jiraHost, { trigger: "test" }, getLogger("test"));
		try {
			await client.getPage(1000);
		} catch (err: unknown) {
			error = err as Error;
		}
		expect(error!).toBeInstanceOf(GithubClientCommitNotFoundBySHAError);
	});
});
