const { Subscription, Project } = require('../models');
const getJiraClient = require('../jira/client');
const parseSmartCommit = require('./smart-commit');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');
const { queues } = require('../worker');
const enhanceOctokit = require('../config/enhance-octokit');

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
  const repository = {
    id: payload.repository.id,
    name: payload.repository.name,
    full_name: payload.repository.full_name,
    html_url: payload.repository.html_url,
    owner: payload.repository.owner,
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

function processPush(app) {
  return async function (job) {
    const {
      repository,
      repository: { owner, name: repo },
      shas,
      installationId,
      jiraHost,
    } = job.data;

    const subscription = await Subscription.getSingleInstallation(
      jiraHost,
      installationId,
    );

    if (!subscription) return {};

    const jiraClient = await getJiraClient(subscription.jiraHost, installationId, app.log);
    const github = await app.auth(installationId);
    enhanceOctokit(github, app.log);

    const commits = await Promise.all(
      shas.map(async sha => {
        const {
          data,
          data: { commit: githubCommit },
        } = await github.repos.getCommit({ owner: owner.login, repo, sha: sha.id });
        const { files } = data;
        // Not all commits have a github author, so create username only if author exists
        const username = data.author ? data.author.login : undefined;
        // Jira only accepts a max of 10 files for each commit, so don't send all of them
        const filesToSend = files.slice(0, 10);
        const isMergeCommit = data.parents && data.parents.length > 1;
        return {
          hash: data.sha,
          message: githubCommit.message,
          author: {
            avatar: username ? `https://github.com/${username}.png` : undefined,
            email: githubCommit.author.email,
            name: githubCommit.author.name,
            url: username ? `https://github.com/${username}` : undefined,
          },
          authorTimestamp: githubCommit.author.date,
          displayId: data.sha.substring(0, 6),
          fileCount: files.length, // Send the total count for all files
          files: filesToSend.map(mapFile),
          id: data.sha,
          issueKeys: sha.issueKeys,
          url: data.html_url,
          updateSequenceId: Date.now(),
          flags:  isMergeCommit ? ["MERGE_COMMIT"] : undefined,
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
  };
}

module.exports = { createJobData, processPush, enqueuePush };
