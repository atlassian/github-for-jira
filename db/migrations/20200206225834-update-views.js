module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
    create or replace view analytics.subscriptions(id, github_installation_id, jira_host, created_at, updated_at, repo_sync_state, selected_repositories, sync_status, sync_warning) as
      SELECT "Subscriptions".id,
            "Subscriptions"."gitHubInstallationId" AS github_installation_id,
            "Subscriptions"."jiraHost"             AS jira_host,
            "Subscriptions"."createdAt"            AS created_at,
            "Subscriptions"."updatedAt"            AS updated_at,
            "Subscriptions"."repoSyncState"        AS repo_sync_state,
            "Subscriptions"."selectedRepositories" AS selected_repositories,
            "Subscriptions"."syncStatus"           AS sync_status,
            "Subscriptions"."syncWarning"          AS sync_warning
      FROM "Subscriptions";
    `)
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
    create or replace view analytics.subscriptions(id, github_installation_id, jira_host, created_at, updated_at, repo_sync_state) as
      SELECT "Subscriptions".id,
            "Subscriptions"."gitHubInstallationId" AS github_installation_id,
            "Subscriptions"."jiraHost"             AS jira_host,
            "Subscriptions"."createdAt"            AS created_at,
            "Subscriptions"."updatedAt"            AS updated_at,
            "Subscriptions"."repoSyncState"        AS repo_sync_state
      FROM "Subscriptions";
  `)
  }
}
