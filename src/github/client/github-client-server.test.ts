/* eslint-disable jest/no-standalone-expect */
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "./github-installation-client";
import { statsd }  from "config/statsd";
import { InstallationId } from "./installation-id";
import nock from "nock";
import { GITHUB_ACCEPT_HEADER } from "utils/get-github-client-config";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "~/src/config/feature-flags";

jest.mock("config/feature-flags");

describe("GitHub Client", () => {
	const githubInstallationId = 17979017;
	let statsdHistogramSpy;

	beforeEach(() => {
		// Lock Time
		statsdHistogramSpy = jest.spyOn(statsd, "histogram");
	});

	afterEach(() => {
		// Unlock Time
		statsdHistogramSpy.mockRestore();
	});

	function givenGitHubReturnsPullrequests(
		owner: string,
		repo: string,
		perPage: number,
		page: number,
		expectedInstallationTokenInHeader?: string,
		scope: nock.Scope = gheApiNock
	) {
		scope
			.get(`/repos/${owner}/${repo}/pulls`)
			.query({
				per_page: perPage,
				page,
				installationId: /^.*$/
			})
			.matchHeader(
				"Authorization",
				expectedInstallationTokenInHeader
					? `Bearer ${expectedInstallationTokenInHeader}`
					: /^Bearer .+$/
			)
			.matchHeader("Accept", GITHUB_ACCEPT_HEADER)
			.reply(200, [
				{ number: 1 } // we don't really care about the shape of this response because it's in GitHub's hands anyways
			]);
	}

	function verifyMetricsSent(path: string, status) {
		expect(statsdHistogramSpy).toBeCalledWith("app.server.http.request.github", expect.anything(), expect.objectContaining({
			client: "axios",
			method: "GET",
			path,
			status,
			gitHubProduct: "server"
		}));
	}

	it("works with a non-cloud installation", async () => {
		const owner = "owner";
		const repo = "repo";
		const pageSize = 5;
		const page = 1;

		gheUserTokenNock(githubInstallationId, "installation token");
		givenGitHubReturnsPullrequests(
			owner,
			repo,
			pageSize,
			page,
			"installation token"
		);

		when(booleanFlag).calledWith(
			BooleanFlags.GHE_SERVER,
			expect.anything(),
			expect.anything()
		).mockResolvedValue(true);

		const client = new GitHubInstallationClient(
			new InstallationId(gheUrl, 4711, githubInstallationId),
			{
				hostname: gheUrl,
				baseUrl: gheUrl,
				apiUrl: gheApiUrl,
				graphqlUrl: gheApiUrl  + "/graphql"
			},
			getLogger("test")
		);

		const pullrequests = await client.getPullRequests(owner, repo, {
			per_page: pageSize,
			page
		});

		expect(pullrequests).toBeTruthy();
		verifyMetricsSent("/api/v3/repos/{owner}/{repo}/pulls", "200");
	});
});
