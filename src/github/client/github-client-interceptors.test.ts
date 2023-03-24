import { createAnonymousClient } from "utils/get-github-client-config";
import { getLogger } from "config/logger";
import { GithubClientInvalidPermissionsError, GithubClientNotFoundError } from "~/src/github/client/github-client-errors";

describe("github-client-interceptors", () => {
	it("correctly maps invalid permission error", async () => {
		gheNock.get("/").reply(403, {
			"message": "Resource not accessible by integration",
			"documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#authentication"
		});

		let error: Error;
		const client = await createAnonymousClient(gheUrl, jiraHost, getLogger("test"));
		try {
			await client.getMainPage(1000);
		} catch (err) {
			error = err;
		}
		expect(error!).toBeInstanceOf(GithubClientInvalidPermissionsError);
	});

	it("correctly maps 404 to not found", async () => {
		gheNock.get("/").reply(404, {
			"message": "Resource not found",
			"documentation_url": "https://docs.github.com/rest/overview/resources-in-the-rest-api#authentication"
		});

		let error: Error;
		const client = await createAnonymousClient(gheUrl, jiraHost, getLogger("test"));
		try {
			await client.getMainPage(1000);
		} catch (err) {
			error = err;
		}
		expect(error!).toBeInstanceOf(GithubClientNotFoundError);
	});


});
