import issueComment from "./issue-comment";
import issue from "./issue";
import middleware from "./middleware";
import pullRequest from "./pull-request";
import workflow from "./workflow";
import deployment from "./deployment";
import push from "./push";
import { createBranch, deleteBranch } from "./branch";
import webhookTimeout from "../middleware/webhook-timeout";
import statsd from "../config/statsd";
import { metricWebhooks } from "../config/metric-names";
import { Application } from "probot";
import { deleteRepository } from "./repository";
import GitHubClient from "./client/github-client";
import { InstallationId } from "./client/installation-id";
import AppTokenHolder from './client/app-token-holder';
import * as path from 'path';
import * as fs from 'fs';

export default (robot: Application) => {
	// TODO: Need ability to remove these listeners, especially for testing...
	robot.on("*", async (context) => {
		const { name, payload, id } = context;

		context.log.info({ event: name, action: payload.action, webhookId: id }, "Event received");

		const tags = [
			"name: webhooks",
			`event: ${name}`,
			`action: ${payload.action}`
		];

		statsd.increment(metricWebhooks.webhookEvent, tags);

		const appTokenHolder = new AppTokenHolder((installationId: InstallationId) => {
			switch (installationId.githubBaseUrl) {
				case "https://api.github.com":
					return "cloud private key";
				case "http://github.internal.atlassian.com/api/v3":
					return fs.readFileSync(path.resolve(__dirname, '../../ghe-spike.2021-12-14.private-key.pem'), {encoding: 'utf-8'});
				default:
					throw new Error("unknown github instance!");
			}
		});

		const githubClient = new GitHubClient(
			new InstallationId("http://github.internal.atlassian.com/api/v3", 1, 2),
			context.log,
			appTokenHolder
		);

		// Prove that we can make a request to GHE
		try {
			const pullrequest = await githubClient.getPullRequest("fusiontestaccount", "ghe-spike", "2");

			context.log("Pull requests: ", pullrequest.data.base.repo)
		} catch (e) {
			console.error("error: ", e.cause.response);
		}
	});



	robot.on(
		["issue_comment.created", "issue_comment.edited"],
		webhookTimeout(middleware(issueComment))
	);

	robot.on(["issues.opened", "issues.edited"], middleware(issue));

	robot.on("push", middleware(push));

	// eslint-disable-next-line @typescript-eslint/ban-ts-comment
	// @ts-ignore
	robot.on(["pull_request.opened","pull_request.closed","pull_request.reopened","pull_request.edited","pull_request_review"],pullRequest);

	robot.on("workflow_run", middleware(workflow));

	robot.on("deployment_status", middleware(deployment));

	robot.on("create", middleware(createBranch));
	robot.on("delete", middleware(deleteBranch));

	robot.on("repository.deleted", middleware(deleteRepository));
};
