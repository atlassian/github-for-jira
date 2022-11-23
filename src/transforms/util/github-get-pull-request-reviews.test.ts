/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import { getPullRequestReviews } from "./github-get-pull-request-reviews";
import { getLogger } from "config/logger";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { getInstallationId } from "~/src/github/client/installation-id";
import pullRequest from "fixtures/api/pull-request.json";

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
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/reviews`)
			.reply(200, { stuff: "things" });
		const client = new GitHubInstallationClient(getInstallationId(GITHUB_INSTALLATION_ID), gitHubCloudConfig, jiraHost, logger);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await getPullRequestReviews(client, MOCK_REPOSITORY, MOCK_PR, logger)).toEqual({ stuff: "things" });
	});

	it("should return empty array with a 404 response", async () => {
		githubUserTokenNock(GITHUB_INSTALLATION_ID);
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/reviews`)
			.reply(404);
		const client = new GitHubInstallationClient(getInstallationId(GITHUB_INSTALLATION_ID), gitHubCloudConfig, jiraHost, logger);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await getPullRequestReviews(client, MOCK_REPOSITORY, MOCK_PR, logger)).toEqual([]);
	});

	it("should return empty array when error thrown", async () => {
		githubUserTokenNock(GITHUB_INSTALLATION_ID);
		const MOCK_REPOSITORY = {
			owner: {
				login: "batman"
			},
			full_name: "tt",//todo put something funny
			html_url: "tt",//todo put something funny
			name: "gotham-city-bus-pass",
			updated_at: "",
			id: 1
		};
		const MOCK_PR = {
			number: 2,
			id: 3
		};
		githubNock
			.get(`/repos/batman/gotham-city-bus-pass/pulls/2/reviews`)
			.replyWithError("something awful happened");
		const client = new GitHubInstallationClient(getInstallationId(GITHUB_INSTALLATION_ID), gitHubCloudConfig, jiraHost, logger);
		// eslint-disable-next-line @typescript-eslint/ban-ts-comment
		// @ts-ignore
		expect(await getPullRequestReviews(client, MOCK_REPOSITORY, MOCK_PR, logger)).toEqual([]);
	});


});
