
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      CREATE OR REPLACE VIEW "analytics"."subscriptions" AS SELECT "Subscriptions".id,
        "Subscriptions"."gitHubInstallationId" AS github_installation_id,
        "Subscriptions"."jiraHost" AS jira_host,
        "Subscriptions"."createdAt" AS created_at,
        "Subscriptions"."updatedAt" AS updated_at,
        "Subscriptions"."repoSyncState" AS repo_sync_state
       FROM "Subscriptions";
    `);

    await queryInterface.sequelize.query(`
      CREATE VIEW analytics.Projects AS (
        SELECT
          id,
          "projectKey" AS project_key,
          "occurrences",
          "jiraHost" as jira_host,
          "updatedAt" as updated_at,
          "createdAt" as created_at
        FROM
          "Projects"
      )`);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DROP VIEW analytics.projects');
  },
};
