module.exports = {
	up: async (queryInterface, Sequelize) => {
		// Drop analytics views
		await queryInterface.sequelize.query("DROP VIEW analytics.installations");
		await queryInterface.sequelize.query("DROP VIEW analytics.subscriptions");
		await queryInterface.removeColumn("Subscriptions", "repoSyncState");
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("Subscriptions", "repoSyncState", {
			type: Sequelize.JSONB,
			allowNull: true
		});

		await queryInterface.sequelize.query(`
    create or replace view analytics.subscriptions(id, github_installation_id, jira_host, created_at, updated_at, repo_sync_state, selected_repositories, sync_status, sync_warning, hours_since_created_at, hours_since_updated_at) as
      SELECT "Subscriptions".id,
            "Subscriptions"."gitHubInstallationId" AS github_installation_id,
            "Subscriptions"."jiraHost"             AS jira_host,
            "Subscriptions"."createdAt"            AS created_at,
            "Subscriptions"."updatedAt"            AS updated_at,
            "Subscriptions"."repoSyncState"        AS repo_sync_state,
            "Subscriptions"."selectedRepositories" AS selected_repositories,
            "Subscriptions"."syncStatus"::text     AS sync_status,
            "Subscriptions"."syncWarning"          AS sync_warning,
            EXTRACT(EPOCH FROM current_timestamp-"Subscriptions"."createdAt")/3600  AS hours_since_created_at,
            EXTRACT(EPOCH FROM current_timestamp-"Subscriptions"."updatedAt")/3600  AS hours_since_updated_at
      FROM "Subscriptions";
    `);


	}
};
