"use strict";

const tableName = "Subscriptions";
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "repositoryCursor", {
			type: Sequelize.STRING,
			allowNull: true
		});
		await queryInterface.addColumn(tableName, "repositoryStatus", {
			type: Sequelize.ENUM("pending", "complete", "failed"),
			allowNull: true
		});
		await queryInterface.addColumn(tableName, "totalNumberOfRepos", {
			type: Sequelize.INTEGER,
			allowNull: true
		});
	},

	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeColumn(tableName, "repositoryCursor");
		await queryInterface.removeColumn(tableName, "repositoryStatus");
		await queryInterface.removeColumn(tableName, "totalNumberOfRepos");
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_repositoryStatus";`);
	}
};
