"use strict";

const tableName = "Installations";

module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.addColumn(tableName, "encryptedSharedSecret", {
			type: Sequelize.TEXT,
			allowNull: true
		});
	},

	down: async (queryInterface) => {
		await queryInterface.removeColumn(tableName, "encryptedSharedSecret");
	}
};
