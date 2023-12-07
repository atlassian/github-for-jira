import { GithubClientBlockedIpError, GithubClientError } from "./github-client-errors";

describe("GitHubClientError", () => {

	it("propagates the stacktrace", async () => {
		const error = new GithubClientBlockedIpError({
			name: "BlockedIpError",
			message: "ignored",
			stack: "existing stack trace line 1\nexisting stack trace line 2\nexisting stack trace line 3",
			config: {},
			isAxiosError: true,
			toJSON: () => {
				return {};
			}
		});

		expect(error.stack).toContain("Blocked by GitHub allowlist");
		expect(error.stack).toContain("existing stack trace line 1");
		expect(error.stack).toContain("existing stack trace line 2");
		expect(error.stack).toContain("existing stack trace line 3");
	});

	it("extract the error response body (empty)", async () => {
		const error = new GithubClientError("test", { } as any);
		expect(error.resBody).toEqual(undefined);
	});

	it("extract the error response body (str)", async () => {
		const error = new GithubClientError("test", { response: { data: "test resp body" } } as any);
		expect(error.resBody).toEqual("test resp body");
	});

	it("extract the error response body (object)", async () => {
		const error = new GithubClientError("test", { response: { data: { hello: "error" } } } as any);
		expect(error.resBody).toEqual(`{"hello":"error"}`);
	});
});
