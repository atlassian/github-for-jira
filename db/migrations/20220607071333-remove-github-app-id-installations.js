'use strict';

const tableName = "Installations";

module.exports = {
	up: async (queryInterface) => {
		await queryInterface.removeColumn(tableName, "githubAppId");
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "githubAppId", {
			type: Sequelize.INTEGER,
			allowNull: true
		});
	}
};
