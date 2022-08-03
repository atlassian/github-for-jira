"use strict";

const tableNames = ["RepoSyncStates"];
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await Promise.all([
			tableNames.map(tableName => queryInterface.addColumn(tableName, "config", {
				type: Sequelize.JSON,
				allowNull: true
			}))
		]);
	},

	down: async (queryInterface, Sequelize) => {
		await Promise.all([
			tableNames.map(tableName => queryInterface.removeColumn(tableName, "config"))
		]);
	}
};
