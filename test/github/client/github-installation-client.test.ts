/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable jest/no-standalone-expect */

import GithubAppClient from "../../../src/github/client/github-app-client";
import GithubInstallationClient from "../../../src/github/client/github-installation-client";
import { AuthToken } from "../../../src/github/client/http-client";
import nock from "nock";

jest.mock("../../../src/github/client/github-app-client");

describe("GitHubInstallationClient", () => {

	const appClientMock = new GithubAppClient("bar", "foo");
	const createInstallationTokenMock = jest.spyOn(appClientMock, "createInstallationToken");

	function givenGitHubReturnsInstallationToken(installationToken: string, expirationDate?: Date) {
		createInstallationTokenMock.mockImplementation(() => Promise.resolve(
			new AuthToken(installationToken, expirationDate || new Date())));
	}

	function givenGitHubReturnsPullrequests(owner: string, repo: string, perPage: number, page: number, expectedInstallationToken?: string) {
		githubNock
			.get(`/repos/${owner}/${repo}/pulls`)
			.query({
				per_page: perPage,
				page,
				installationId: /^.*$/
			})
			.matchHeader("Authorization", expectedInstallationToken ? `Bearer ${expectedInstallationToken}` : /^Bearer .+$/)
			.matchHeader("Accept", "application/vnd.github.v3+json")
			.matchHeader("User-Agent", /^.*$/)
			.reply(200, [
				{ number: 1 } // we don't really care about the contents of the response in this test because it depends on the real GitHub API, anyways
			]);
	}

	afterEach(() => {
		nock.cleanAll();
		jest.restoreAllMocks();
	});

	it("lists pull requests", async () => {

		const installationId = 123456;
		const owner = "owner";
		const repo = "repo";
		const pageSize = 5;
		const page = 1;

		givenGitHubReturnsInstallationToken("installation token");
		givenGitHubReturnsPullrequests(owner, repo, pageSize, page);

		const client = new GithubInstallationClient(appClientMock);
		const pullrequests = await client.getPullRequests(installationId, owner, repo, pageSize, page);

		expect(pullrequests).toBeTruthy();
		expect(githubNock.pendingMocks()).toEqual([]);
	});

	it("re-generates expired installation token", async () => {

		const originalInstallationToken = "original installation token";
		const freshInstallationToken = "fresh installation token";
		const installationId = 123456;
		const owner = "owner";
		const repo = "repo";
		const pageSize = 5;
		const page = 1;
		let now = new Date(2021, 10, 24, 0, 0);
		const expirationDate = new Date(2021, 10, 24, 0, 10);
		const freshExpirationDate = new Date(2021, 10, 24, 0, 20);

		const client = new GithubInstallationClient(appClientMock, "https://api.github.com", () => now);

		givenGitHubReturnsInstallationToken(originalInstallationToken, expirationDate);
		givenGitHubReturnsPullrequests(owner, repo, pageSize, page, originalInstallationToken);
		const pullrequests = await client.getPullRequests(installationId, owner, repo, pageSize, page);
		expect(pullrequests).toBeTruthy();
		expect(githubNock.pendingMocks()).toEqual([]);

		// after 5 minutes we still expect the original installation token, because the token is still valid
		now = new Date(2021, 10, 24, 0, 5)
		givenGitHubReturnsInstallationToken(freshInstallationToken, freshExpirationDate);
		givenGitHubReturnsPullrequests(owner, repo, pageSize, page, originalInstallationToken);
		const pullrequests2 = await client.getPullRequests(installationId, owner, repo, pageSize, page);
		expect(pullrequests2).toBeTruthy();
		expect(githubNock.pendingMocks()).toEqual([]);

		// after 10 minutes we expect a fresh installation token because the original token is about to expire
		now = new Date(2021, 10, 24, 0, 10)
		givenGitHubReturnsInstallationToken(freshInstallationToken, freshExpirationDate);
		givenGitHubReturnsPullrequests(owner, repo, pageSize, page, freshInstallationToken);
		const pullrequests3 = await client.getPullRequests(installationId, owner, repo, pageSize, page);
		expect(pullrequests3).toBeTruthy();
		expect(githubNock.pendingMocks()).toEqual([]);

	});

});

