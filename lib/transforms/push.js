const { Subscription, Project } = require('../models');
const getJiraClient = require('../jira/client');
const parseSmartCommit = require('./smart-commit');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');
const { queues } = require('../worker');
const enhanceOctokit = require('../config/enhance-octokit');
const probotApp = require('../worker/app');
const { getLog } = require('../config/logger');

let logger = getLog();

function mapFile(githubFile) {
  // changeType enum: [ "ADDED", "COPIED", "DELETED", "MODIFIED", "MOVED", "UNKNOWN" ]
  // on github when a file is renamed we get two "files": one added, one removed
  const mapStatus = {
    added: 'ADDED',
    removed: 'DELETED',
    modified: 'MODIFIED',
  };
  const {
    filename: path,
    status,
    additions: linesAdded,
    deletions: linesRemoved,
    blob_url: url,
  } = githubFile;
  return {
    path,
    changeType: mapStatus[status] || 'UNKNOWN',
    linesAdded,
    linesRemoved,
    url,
  };
}

function createJobData(payload, jiraHost) {
  // Store only necessary repository data in the queue
  const {
    id, name, full_name, html_url, owner,
  } = payload.repository;

  const repository = {
    id,
    name,
    full_name,
    html_url,
    owner,
  };

  const shas = [];
  for (const commit of payload.commits) {
    const { issueKeys } = parseSmartCommit(commit.message);

    if (!issueKeys) {
      // Don't add this commit to the queue since it doesn't have issue keys
      continue;
    }

    // Only store the sha and issue keys. All other data will be requested from GitHub as part of the job
    // Creates an array of shas for the job processor to work on
    shas.push({ id: commit.id, issueKeys });
  }
  return {
    repository,
    shas,
    jiraHost,
    installationId: payload.installation.id,
  };
}

async function enqueuePush(payload, jiraHost) {
  const jobOpts = { removeOnFail: true, removeOnComplete: true };
  const jobData = createJobData(payload, jiraHost);

  await queues.push.add(
    jobData,
    jobOpts,
  );
}

function processPush() {
  return async function (job) {
    try {
      const {
        repository,
        repository: { owner, name: repo },
        shas,
        installationId,
        jiraHost,
      } = job.data;
      const app = await probotApp(jiraHost);
      const subscription = await Subscription.getSingleInstallation(
        jiraHost,
        installationId,
      );

      if (!subscription) return {};

      const jiraClient = await getJiraClient(subscription.jiraHost, installationId, logger);
      const github = await app.auth(installationId);
      enhanceOctokit(github, logger);

      const commits = await Promise.all(
        shas.map(async sha => {
          const {
            data,
            data: { commit: githubCommit },
          } = await github.repos.getCommit({ owner: owner.login, repo, ref: sha.id });

          const {
            files, author, parents, sha: commitSha, html_url,
          } = data;

          const { author: githubCommitAuthor, message } = githubCommit;

          // Not all commits have a github author, so create username only if author exists
          const username = author ? author.login : undefined;

          // Jira only accepts a max of 10 files for each commit, so don't send all of them
          const filesToSend = files.slice(0, 10);

          // merge commits will have 2 or more parents, depending how many are in the sequence
          const isMergeCommit = parents && parents.length > 1;

          return {
            hash: commitSha,
            message,
            author: {
              avatar: username ? `https://github.com/${username}.png` : undefined,
              email: githubCommitAuthor.email,
              name: githubCommitAuthor.name,
              url: username ? `https://github.com/${username}` : undefined,
            },
            authorTimestamp: githubCommitAuthor.date,
            displayId: commitSha.substring(0, 6),
            fileCount: files.length, // Send the total count for all files
            files: filesToSend.map(mapFile),
            id: commitSha,
            issueKeys: sha.issueKeys,
            url: html_url,
            updateSequenceId: Date.now(),
            flags: isMergeCommit ? ['MERGE_COMMIT'] : undefined,
          };
        }),
      );

      // Jira accepts up to 400 commits per request
      // break the array up into chunks of 400
      const chunks = [];
      while (commits.length) {
        chunks.push(commits.splice(0, 400));
      }

      for (const chunk of chunks) {
        const jiraPayload = {
          name: repository.name,
          url: repository.html_url,
          id: repository.id,
          commits: chunk,
          updateSequenceId: Date.now(),
        };

        await jiraClient.devinfo.repository.update(jiraPayload);

        const projects = [];
        jiraPayload.commits.map(commit => reduceProjectKeys(commit, projects));

        for (const projectKey of projects) {
          await Project.upsert(projectKey, jiraClient.baseURL);
        }
      }
    } catch (error) {
      logger.error(`Failed to process push: ${error}`);
    }
  };
}

module.exports = { createJobData, processPush, enqueuePush };
