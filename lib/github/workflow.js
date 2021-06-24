const { Project } = require('../models');
const transformWorkflows = require('../transforms/workflow');
const reduceProjectKeys = require('../jira/util/reduce-project-keys');

module.exports = async (context, jiraClient) => {
  const { workflow_run: { check_suite_id } } = context.payload;

  try {
    const checkSuite = await context.github.checks.getSuite({
      owner: context.payload.repository.owner.login,
      repo: context.payload.repository.name,
      check_suite_id,
    });

    // Solution for releasing MVP of GitHub Actions and avoid data duplication in Jira.
    if (checkSuite.data.app.slug === 'github-actions') {
      const { data: jiraPayload } = transformWorkflows(context.payload);

      if (!jiraPayload) {
        context.log({ noop: 'no_jira_payload_check_run' }, 'Halting further execution for check since jiraPayload is empty');
        return;
      }

      await jiraClient.workflow.submit(jiraPayload);

      const projects = [];
      reduceProjectKeys(jiraPayload, projects);

      for (const projectKey of projects) {
        await Project.upsert(projectKey, jiraClient.baseURL);
      }
    }
  } catch (e) {
    context.log.warn({
      error: e,
      payload: context.payload,
    }, "Can't retrieve check suite. Skipping workflow.");
  }
};
