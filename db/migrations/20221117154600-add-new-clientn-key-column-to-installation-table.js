"use strict";

const tableName = "Installations";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "jiraClientKey", {
			type: Sequelize.STRING,
			allowNull: true
		});
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn(tableName, "jiraClientKey");
	}
};
