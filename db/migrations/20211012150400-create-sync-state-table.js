"use strict";

const tableName = "RepoSyncState";
module.exports = {
	up: async (queryInterface, Sequelize) => {
		await queryInterface.createTable(tableName, {
			id: {
				type: Sequelize.INTEGER,
				allowNull: false,
				autoIncrement: true,
				primaryKey: true
			},
			subscriptionId: {
				type: Sequelize.INTEGER,
				allowNull: false,
				references: {
					model: "Subscriptions",
					key: "id"
				}
			},
			repoId: {
				type: Sequelize.INTEGER,
				allowNull: false
			},
			repoName: {
				type: Sequelize.STRING,
				allowNull: false
			},
			repoOwner: {
				type: Sequelize.STRING,
				allowNull: false
			},
			repoFullName: {
				type: Sequelize.STRING,
				allowNull: false
			},
			repoUrl: {
				type: Sequelize.STRING,
				allowNull: false
			},
			priority: {
				type: Sequelize.INTEGER
			},
			status: {
				type: Sequelize.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
			},
			branchStatus: {
				type: Sequelize.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
			},
			commitStatus: {
				type: Sequelize.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
			},
			issueStatus: {
				type: Sequelize.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
			},
			pullStatus: {
				type: Sequelize.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
			},
			buildStatus: {
				type: Sequelize.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
			},
			deploymentStatus: {
				type: Sequelize.ENUM('PENDING', 'COMPLETE', 'ACTIVE', 'FAILED'),
			},
			branchCursor: {
				type: Sequelize.STRING
			},
			commitCursor: {
				type: Sequelize.STRING
			},
			issueCursor: {
				type: Sequelize.STRING
			},
			pullCursor: {
				type: Sequelize.STRING
			},
			buildCursor: {
				type: Sequelize.STRING
			},
			deploymentCursor: {
				type: Sequelize.STRING
			},
			forked: {
				type: Sequelize.BOOLEAN
			},
			repoPushedAt: {
				type: Sequelize.DATE
			},
			repoCreatedAt: {
				type: Sequelize.DATE
			},
			repoUpdatedAt: {
				type: Sequelize.DATE
			},
			syncUpdatedAt: {
				type: Sequelize.DATE
			},
			syncCompletedAt: {
				type: Sequelize.DATE
			},
			updatedAt: {
				type: Sequelize.DATE,
				allowNull: false,
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false,
			}
		});
	},
	down: async (queryInterface, Sequelize) => {
		await queryInterface.dropTable(tableName);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_status";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_branchStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_commitStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_issueStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_pullStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_buildStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_deploymentStatus";`);
	}
};
