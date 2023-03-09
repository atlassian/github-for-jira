"use strict";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn("RepoSyncStates", "failedCode", { type: Sequelize.INTEGER , allowNull: true });
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn("RepoSyncStates", "failedCode");
	}
};
