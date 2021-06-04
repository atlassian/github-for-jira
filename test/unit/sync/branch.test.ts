/* eslint-disable @typescript-eslint/no-var-requires,@typescript-eslint/no-explicit-any */
import parseSmartCommit from "../../../src/transforms/smart-commit";
import { branchesNoLastCursor, branchesWithLastCursor } from "../../fixtures/api/graphql/branch-queries";
import { mocked } from "ts-jest/utils";
import { Subscription } from "../../../src/models";
import { Application } from "probot";
import { createApp } from "../../utils/probot";
import createJob from "../../setup/create-job";
import { processInstallation } from "../../../src/sync/installation";
import nock from "nock";

jest.mock("../../../src/models");

describe("sync/branches", () => {
  const installationId = 1234;
  let delay;
  let app: Application;
  const branchNodesFixture = require("../../fixtures/api/graphql/branch-ref-nodes.json");
  const emptyNodesFixture = require("../../fixtures/api/graphql/branch-empty-nodes.json");
  const branchCommitsHaveKeys = require("../../fixtures/api/graphql/branch-commits-have-keys.json");
  const associatedPRhasKeys = require("../../fixtures/api/graphql/branch-associated-pr-has-keys.json");
  const branchNoIssueKeys = require("../../fixtures/api/graphql/branch-no-issue-keys.json");

  function makeExpectedResponse({ branchName }) {
    const { issueKeys } = parseSmartCommit(branchName);
    return {
      preventTransitions: true,
      repositories: [
        {
          branches: [
            {
              createPullRequestUrl: `test-repo-url/pull/new/${branchName}`,
              id: branchName,
              issueKeys: ["TES-123"].concat(issueKeys).reverse().filter(Boolean),
              lastCommit: {
                author: {
                  avatar: "https://camo.githubusercontent.com/test-avatar",
                  name: "test-author-name"
                },
                authorTimestamp: "test-authored-date",
                displayId: "test-o",
                fileCount: 0,
                hash: "test-oid",
                id: "test-oid",
                issueKeys: ["TES-123"],
                message: "TES-123 test-commit-message",
                url: "test-repo-url/commit/test-sha",
                updateSequenceId: 12345678
              },
              name: branchName,
              url: `test-repo-url/tree/${branchName}`,
              updateSequenceId: 12345678
            }
          ],
          commits: [
            {
              author: {
                avatar: "https://camo.githubusercontent.com/test-avatar",
                email: "test-author-email@example.com",
                name: "test-author-name"
              },
              authorTimestamp: "test-authored-date",
              displayId: "test-o",
              fileCount: 0,
              hash: "test-oid",
              id: "test-oid",
              issueKeys: ["TES-123"],
              message: "TES-123 test-commit-message",
              timestamp: "test-authored-date",
              url: "test-repo-url/commit/test-sha",
              updateSequenceId: 12345678
            }
          ],
          id: "test-repo-id",
          name: "test-repo-name",
          url: "test-repo-url",
          updateSequenceId: 12345678
        }
      ],
      properties: {
        installationId: installationId
      }
    };
  }

  function nockBranchRequest(fixture) {
    githubNock
      .post("/graphql", branchesNoLastCursor)
      .reply(200, fixture)
      .post("/graphql", branchesWithLastCursor)
      .reply(200, emptyNodesFixture);
  }

  beforeEach(async () => {
    const repoSyncStatus = {
      installationId: installationId,
      jiraHost: "tcbyrd.atlassian.net",
      repos: {
        "test-repo-id": {
          repository: {
            name: "test-repo-name",
            owner: { login: "integrations" },
            html_url: "test-repo-url",
            id: "test-repo-id"
          },
          pullStatus: "complete",
          branchStatus: "pending",
          commitStatus: "complete"
        }
      }
    };
    delay = process.env.LIMITER_PER_INSTALLATION = "2000";

    Date.now = jest.fn(() => 12345678);

    mocked(
      Subscription.getSingleInstallation
    ).mockResolvedValue({
      jiraHost,
      id: 1,
      get: () => repoSyncStatus,
      set: () => repoSyncStatus,
      save: () => Promise.resolve({}),
      update: () => Promise.resolve({})
    } as any);

    app = await createApp();
  });

  it("should sync to Jira when branch refs have jira references", async () => {
    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });
    nockBranchRequest(branchNodesFixture);

    jiraNock
      .post("/rest/devinfo/0.10/bulk",
        makeExpectedResponse({ branchName: "TES-321-branch-name" }))
      .reply(200);

    const queues = {
      installation: {
        add: jest.fn()
      }
    };
    await expect(processInstallation(app, queues)(job)).toResolve();
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
  });

  it("should send data if issue keys are only present in commits", async () => {

    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });
    nockBranchRequest(branchCommitsHaveKeys);

    jiraNock.post("/rest/devinfo/0.10/bulk", makeExpectedResponse({
      branchName: "dev"
    })).reply(200);

    const queues = {
      installation: {
        add: jest.fn()
      }
    };
    await expect(processInstallation(app, queues)(job)).toResolve();
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
  });

  it("should send data if issue keys are only present in an associatd PR title", async () => {
    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });
    nockBranchRequest(associatedPRhasKeys);

    jiraNock.post("/rest/devinfo/0.10/bulk", {
      preventTransitions: true,
      repositories: [
        {
          branches: [
            {
              createPullRequestUrl: "test-repo-url/pull/new/dev",
              id: "dev",
              issueKeys: ["PULL-123"],
              lastCommit: {
                author: {
                  avatar: "https://camo.githubusercontent.com/test-avatar",
                  name: "test-author-name"
                },
                authorTimestamp: "test-authored-date",
                displayId: "test-o",
                fileCount: 0,
                hash: "test-oid",
                issueKeys: ["PULL-123"],
                id: "test-oid",
                message: "test-commit-message",
                url: "test-repo-url/commit/test-sha",
                updateSequenceId: 12345678
              },
              name: "dev",
              url: "test-repo-url/tree/dev",
              updateSequenceId: 12345678
            }
          ],
          commits: [],
          id: "test-repo-id",
          name: "test-repo-name",
          url: "test-repo-url",
          updateSequenceId: 12345678
        }
      ],
      properties: {
        installationId: installationId
      }
    }).reply(200);

    const queues = {
      installation: {
        add: jest.fn()
      }
    };
    await expect(processInstallation(app, queues)(job)).toResolve();
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
  });

  it("should not call Jira if no issue keys are found", async () => {
    const job = createJob({ data: { installationId, jiraHost }, opts: { delay } });
    nockBranchRequest(branchNoIssueKeys);

    const queues = {
      installation: {
        add: jest.fn()
      }
    };

    const interceptor = jiraNock.post(/.*/);
    const scope = interceptor.reply(200);

    await expect(processInstallation(app, queues)(job)).toResolve();
    expect(queues.installation.add).toHaveBeenCalledWith(job.data, job.opts);
    expect(scope).not.toBeDone();
    nock.removeInterceptor(interceptor);
  });
});
