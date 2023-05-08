"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		/**
		 * Add altering commands here.
		 *
		 * Example:
		 * await queryInterface.createTable("users", { id: Sequelize.INTEGER });
		 */
		await queryInterface.addColumn("GitHubServerApps", "apiKeyHeaderName", {
			type: Sequelize.STRING(1024),
			allowNull: true
		});

		await queryInterface.addColumn("GitHubServerApps", "encryptedApiKeyValue", {
			type: Sequelize.TEXT,
			allowNull: true
		});
	},

	down: async (queryInterface) => {
		/**
		 * Add reverting commands here.
		 *
		 * Example:
		 * await queryInterface.dropTable("users");
		 */
		await queryInterface.removeColumn("GitHubServerApps", "apiKeyHeaderName");
		await queryInterface.removeColumn("GitHubServerApps", "encryptedApiKeyValue");
	}
};
