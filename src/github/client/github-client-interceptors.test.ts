import { createAnonymousClient } from "utils/get-github-client-config";
import { getLogger } from "config/logger";
import { InvalidPermissionsError } from "~/src/github/client/github-client-errors";

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
		expect(error!).toBeInstanceOf(InvalidPermissionsError);
	});
});
