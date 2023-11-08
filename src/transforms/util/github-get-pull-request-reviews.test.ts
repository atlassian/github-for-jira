/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { getPullRequestReviews } from "./github-get-pull-request-reviews";
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { getInstallationId } from "~/src/github/client/installation-id";
import pullRequest from "fixtures/api/pull-request.json";

jest.mock("config/feature-flags");

describe("getPullRequestReviews", () => {
	const GITHUB_INSTALLATION_ID = 1234;
	const logger = getLogger("test");
	const MOCK_REPOSITORY = {
		owner: {
			login: "batman"
		},
		full_name: "batman/gotham-city-bus-pass",
		html_url: "fake path",
		name: "gotham-city-bus-pass",
		updated_at: "",
		id: 1
	};
	const MOCK_PR = {
		...pullRequest,
		number: 2,
		id: 3
	};

	it("should return array of reviewers with valid repo and pr", async () => {
		githubUserTokenNock(GITHUB_INSTALLATION_ID);
		githubUserTokenNock(GITHUB_INSTALLATION_ID);
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/requested_reviewers`)
			.reply(200, {
				users: []
			});
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/reviews`)
			.reply(200, [{ stuff: "things" }]);
		const client = new GitHubInstallationClient(getInstallationId(GITHUB_INSTALLATION_ID), gitHubCloudConfig, jiraHost, { trigger: "test" }, logger);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await getPullRequestReviews(jiraHost, client, MOCK_REPOSITORY, MOCK_PR, logger)).toEqual([{ stuff: "things" }]);
	});

	it("should map a error from /reviews into an empty array", async () => {
		githubUserTokenNock(GITHUB_INSTALLATION_ID);
		githubUserTokenNock(GITHUB_INSTALLATION_ID);
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/requested_reviewers`)
			.reply(200, {
				users: []
			});
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/reviews`)
			.reply(404);
		const client = new GitHubInstallationClient(getInstallationId(GITHUB_INSTALLATION_ID), gitHubCloudConfig, jiraHost, { trigger: "test" }, logger);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await getPullRequestReviews(jiraHost, client, MOCK_REPOSITORY, MOCK_PR, logger)).toEqual([]);
	});

	it("should map a error from /requested_reviewers into an empty array", async () => {
		githubUserTokenNock(GITHUB_INSTALLATION_ID);
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/requested_reviewers`)
			.reply(500);
		const client = new GitHubInstallationClient(getInstallationId(GITHUB_INSTALLATION_ID), gitHubCloudConfig, jiraHost, { trigger: "test" }, logger);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await getPullRequestReviews(jiraHost, client, MOCK_REPOSITORY, MOCK_PR, logger)).toEqual([]);
	});

	it("should merge requested_reviewers and reviews together", async () => {
		githubUserTokenNock(GITHUB_INSTALLATION_ID);
		githubUserTokenNock(GITHUB_INSTALLATION_ID);
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/requested_reviewers`)
			.reply(200, {
				users: [{
					...pullRequest.user,
					login: "requestedReviewer"
				}]
			});
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/reviews`)
			.reply(200, [{
				state: "APPROVED",
				user: pullRequest.user
			}]);
		const client = new GitHubInstallationClient(getInstallationId(GITHUB_INSTALLATION_ID), gitHubCloudConfig, jiraHost, { trigger: "test" }, logger);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		const result = await getPullRequestReviews(jiraHost, client, MOCK_REPOSITORY, MOCK_PR, logger);

		expect(result[0].user.login).toStrictEqual("requestedReviewer");
		expect(result[0].state).toBeUndefined();
		expect(result[1].user.login).toStrictEqual(pullRequest.user.login);
		expect(result[1].state).toStrictEqual("APPROVED");
	});
});
