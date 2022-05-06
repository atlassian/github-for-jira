import { emitWebhookProcessedMetrics } from "utils/webhook-utils";
import { CustomContext } from "middleware/github-webhook-middleware";
import { GitHubInstallationClient } from "./client/github-installation-client";
import { getCloudInstallationId } from "./client/installation-id";
import { WebhookPayloadIssues } from "@octokit/webhooks";

export const issueWebhookHandler = async (context: CustomContext<WebhookPayloadIssues>, jiraClient, util, githubInstallationId: number): Promise<void> => {
	const { issue, repository } = context.payload;

	try {
		const data = `{
  "update": {},
  "fields": {
    "summary": "Main order flow broken",
    "parent": {
      "key": "T1"
    },
    "issuetype": {
      "id": "10000"
    },
    "components": [
      {
        "id": "10000"
      }
    ],
    "customfield_20000": "06/Jul/19 3:25 PM",
    "customfield_40000": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Occurs on all orders",
              "type": "text"
            }
          ]
        }
      ]
    },
    "customfield_70000": [
      "jira-administrators",
      "jira-software-users"
    ],
    "project": {
      "id": "10000"
    },
    "description": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Order entry fails when selecting supplier.",
              "type": "text"
            }
          ]
        }
      ]
    },
    "reporter": {
      "id": "5b10a2844c20165700ede21g"
    },
    "fixVersions": [
      {
        "id": "10001"
      }
    ],
    "customfield_10000": "09/Jun/19",
    "priority": {
      "id": "20000"
    },
    "labels": [
      "bugfix",
      "blitz_test"
    ],
    "timetracking": {
      "remainingEstimate": "5",
      "originalEstimate": "10"
    },
    "customfield_30000": [
      "10000",
      "10002"
    ],
    "customfield_80000": {
      "value": "red"
    },
    "security": {
      "id": "10000"
    },
    "environment": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "text": "UAT",
              "type": "text"
            }
          ]
        }
      ]
    },
    "versions": [
      {
        "id": "10000"
      }
    ],
    "duedate": "2019-05-11",
    "customfield_60000": "jira-software-users",
    "customfield_50000": {
      "type": "doc",
      "version": 1,
      "content": [
        {
          "type": "paragraph",
          "content": [
            {
              "text": "Could impact day-to-day work.",
              "type": "text"
            }
          ]
        }
      ]
    },
    "assignee": {
      "id": "5b109f2e9729b51b54dc274d"
    }
  }
}`;
		// const issues =	await jiraClient.issues.comments.addForIssue('TI-1', {
		// 	body: "some test TI-1"
		// });
		const issues = await jiraClient.issues.create(data);
		console.log("issues: ", issues)

	} catch (e) {
		context.log.error("ERROR: ", e)
	}

	const githubClient = new GitHubInstallationClient(getCloudInstallationId(githubInstallationId), context.log);

	// TODO: need to create reusable function for unfurling
	let linkifiedBody;
	try {
		linkifiedBody = await util.unfurl(issue.body);
		if (!linkifiedBody) {
			context.log("Halting further execution for issue since linkifiedBody is empty");
			return;
		}
	} catch (err) {
		context.log.warn(
			{ err, linkifiedBody, body: issue.body },
			"Error while trying to find jira keys in issue body"
		);
	}

	context.log(`Updating issue in GitHub with issueId: ${issue.id}`);

	const githubResponse = await githubClient.updateIssue({
		body: linkifiedBody,
		owner: repository.owner.login,
		repo: repository.name,
		issue_number: issue.number
	});
	const { webhookReceived, name, log } = context;

	webhookReceived && emitWebhookProcessedMetrics(
		webhookReceived,
		name,
		log,
		githubResponse?.status
	);
};
