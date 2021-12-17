import { InstallationId } from "./client/installation-id";
import { CustomContext } from "./middleware";
import AppTokenHolder from "./client/app-token-holder";
import * as fs from "fs";
import * as path from "path";
import { getLastCommit } from "../transforms/branch";
import { getJiraId } from "../jira/util/id";
import GitHubClient from "./client/github-client";

export default async (context: CustomContext, jiraClient): Promise<void> => {
	console.log("Pushing...");

	const appTokenHolder = new AppTokenHolder(
		(installationId: InstallationId) => {
			switch (installationId.githubBaseUrl) {
				case "https://api.github.com":
					return "cloud private key";
				case "http://github.internal.atlassian.com/api/v3":
					return fs.readFileSync(
						path.resolve(
							__dirname,
							"../../ghe-spike.2021-12-14.private-key.pem"
						),
						{ encoding: "utf-8" }
					);
				default:
					throw new Error("unknown github instance!");
			}
		}
	);

	const githubClient = new GitHubClient(
		new InstallationId("http://github.internal.atlassian.com/api/v3", 1, 2),
		context.log,
		appTokenHolder
	);

	// Prove that we can make a request to GHE
	try {
		const pullrequest = await githubClient.getPullRequest(
			"fusiontestaccount",
			"ghe-spike",
			"2"
		);

		context.log("Pull requests: ", pullrequest.data.base.repo);
	} catch (e) {
		console.error("error: ", e.cause.response);
	}

	const lastCommit = await getLastCommit(context, ["test-178"]);
	const { ref } = context.payload;

	const jiraPayload = {
		id: "85795",
		name: "fusiontestaccount/ghe-spike",
		url: "http://github.internal.atlassian.com/fusiontestaccount",
		branches: [
			{
				createPullRequestUrl: `http://github.internal.atlassian.com/fusiontestaccount/pull/new/${ref}`,
				lastCommit,
				id: getJiraId(ref),
				issueKeys: ["TEST-178"],
				name: ref,
				url: `http://github.internal.atlassian.com/fusiontestaccount/tree/${ref}`,
				updateSequenceId: Date.now(),
			},
		],
		updateSequenceId: Date.now(),
	};

	if (!jiraPayload) {
		context.log(
			{ noop: "no_jira_payload_create_branch" },
			"Halting further execution for createBranch since jiraPayload is empty"
		);
		return;
	}

	try {
		const jiraResponse = await jiraClient.devinfo.repository.update(
			jiraPayload
		);
		context.log(jiraResponse);
	} catch (e) {
		context.log.error("ERROR: ", e);
	}
};
