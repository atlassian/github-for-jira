module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query('CREATE SCHEMA analytics;')

    await queryInterface.sequelize.query(`
      CREATE VIEW analytics.Subscriptions AS (
        SELECT
          id,
          "gitHubInstallationId" AS github_installation_id,
          "jiraHost" AS jira_host,
          "createdAt" as created_at,
          "updatedAt" as updated_at
        FROM
          "Subscriptions"
      )
    `)

    await queryInterface.sequelize.query(`
      CREATE VIEW analytics.Installations AS (
        SELECT
          id,
          "jiraHost" AS jira_host,
          "createdAt" as created_at,
          "updatedAt" as updated_at,
          enabled
        FROM
          "Installations"
      )
    `)
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query('DROP SCHEMA analytics CASCADE;')
  }
}
