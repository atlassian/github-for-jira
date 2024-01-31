import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { GitHubIssue, GitHubIssueCommentData } from "interfaces/github";
import { createInstallationClient } from "utils/get-github-client-config";
import { WebhookContext } from "routes/github/webhook/webhook-context";
import { GitHubInstallationClient } from "~/src/github/client/github-installation-client";
import { jiraIssueKeyParser } from "utils/jira-utils";
import { getJiraClient } from "~/src/jira/client/jira-client";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

export const issueCommentWebhookHandler = async (
	context: WebhookContext,
	jiraClient,
	util,
	gitHubInstallationId: number
): Promise<void> => {
	const {
		comment,
		repository: {
			name: repoName,
			owner: { login: owner }
		}
	} = context.payload;

	const jiraHost = jiraClient.baseURL;

	context.log = context.log.child({
		gitHubInstallationId,
		jiraHost
	});

	let linkifiedBody;
	const gitHubAppId = context.gitHubAppConfig?.gitHubAppId;
	const metrics = {
		trigger: "webhook",
		subTrigger: "issueComment"
	};
	const gitHubInstallationClient = await createInstallationClient(gitHubInstallationId, jiraClient.baseURL, metrics, context.log, gitHubAppId);

	if (await booleanFlag(BooleanFlags.SEND_PR_COMMENTS_TO_JIRA, jiraHost)){
		await syncIssueCommentsToJira(jiraClient.baseURL, context, gitHubInstallationClient);
	}

	// TODO: need to create reusable function for unfurling
	try {
		linkifiedBody = await util.unfurl(comment.body);
		if (!linkifiedBody) {
			context.log.debug("Halting further execution for issueComment since linkifiedBody is empty");
			return;
		}
	} catch (err: unknown) {
		context.log.warn(
			{ err, linkifiedBody, body: comment.body },
			"Error while trying to find Jira keys in comment body"
		);
	}

	context.log.info(`Updating comment in GitHub with ID ${comment.id as number}`);
	const updatedIssueComment: GitHubIssueCommentData = {
		body: linkifiedBody,
		owner,
		repo: repoName,
		comment_id: comment.id
	};

	let status;
	try {
		const githubResponse: GitHubIssue = await gitHubInstallationClient.updateIssueComment(updatedIssueComment);
		status = githubResponse.status;
	} catch (err: unknown) {
		context.log.warn({ err }, "Cannot modify issue comment");
	}
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		jiraClient.baseURL,
		log,
		status,
		gitHubAppId
	);
};

const syncIssueCommentsToJira = async (jiraHost: string, context: WebhookContext, gitHubInstallationClient: GitHubInstallationClient) => {
	const { comment, repository, issue } = context.payload;
	const { id: gitHubId } = comment;
	const gitHubLogin: string = comment.user?.login ?? "undefined";
	const gitHubMessage: string = comment.body ?? "undefined";
	const gitHubCommentUrl: string = comment.html_url ?? "undefined";
	const pullRequest = await gitHubInstallationClient.getPullRequest(repository.owner.login, repository.name, issue.number);
	// Note: we are only considering the branch name here. Should we also check for pr titles?
	const issueKey = jiraIssueKeyParser(pullRequest.data.head.ref)[0] || "";
	const jiraClient = await getJiraClient(
		jiraHost,
		gitHubInstallationClient.githubInstallationId.installationId,
		context.gitHubAppConfig?.gitHubAppId,
		context.log
	);

	if (!jiraClient) {
		context.log.info("Halting further execution for syncIssueCommentsToJira as JiraClient is empty for this installation");
		return;
	}

	const formattedComment = {
		"content": [
			{
				"type": "paragraph",
				"content": [
					{
						"type": "text",
						"text": `${gitHubLogin}`,
						"marks": [
							{
								"type": "strong"
							}
						]
					},
					{
						"type": "text",
						"text": " left a comment "
					},
					{
						"type": "text",
						"text": "on GitHub",
						"marks": [
							{
								"type": "link",
								"attrs": {
									"href": `${gitHubCommentUrl}`
								}
							}
						]
					},
					{
						"type": "text",
						"text": ":"
					}
				]
			},
			{
				"type": "blockquote",
				"content": [
					{
						"type": "paragraph",
						"content": [
							{
								"type": "text",
								"text": `${gitHubMessage}`
							}
						]
					}
				]
			}
		],
		"type": "doc",
		"version": 1
	};

	switch (context.action) {
		case "created": {
			await jiraClient.issues.comments.addForIssue(issueKey, {
				body: formattedComment,
				properties: [
					{
						key: "gitHubId",
						value: {
							gitHubId
						}
					}
				]
			});
			break;
		}
		case "edited": {
			await jiraClient.issues.comments.updateForIssue(issueKey, await getCommentId(jiraClient, issueKey, gitHubId), {
				body: formattedComment
			});
			break;
		}
		case "deleted":
			await jiraClient.issues.comments.deleteForIssue(issueKey, await getCommentId(jiraClient, issueKey, gitHubId));
			break;
		default:
			context.log.error("This shouldn't happen", context);
			break;
	}
};

const getCommentId = async (jiraClient, issueKey: string, gitHubId: string) => {

	// TODO - this currently only fetchs 50, do we want to loop de loop and find everything!?!?!?
	const listOfComments = await jiraClient.issues.comments.list(issueKey);

	// TODO Tidy up the getting of the githubid from comment props
	const mappedResults = listOfComments.data.comments.map(comment => {
		return {
			commentId: comment.id,
			gitHubId: comment.properties?.find(prop => {
				return prop.key === "gitHubId";
			})?.value?.gitHubId
		};
	});

	return mappedResults.find(comment => {
		return comment.gitHubId === gitHubId;
	})?.commentId;
};
