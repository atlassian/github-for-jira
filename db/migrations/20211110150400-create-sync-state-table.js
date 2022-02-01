"use strict";

const tableName = "RepoSyncStates";
const indexName = `${tableName}_subscriptionId_repoId_idx`
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
			branchStatus: {
				type: Sequelize.ENUM("pending", "complete", "failed")
			},
			commitStatus: {
				type: Sequelize.ENUM("pending", "complete", "failed")
			},
			issueStatus: {
				type: Sequelize.ENUM("pending", "complete", "failed")
			},
			pullStatus: {
				type: Sequelize.ENUM("pending", "complete", "failed")
			},
			buildStatus: {
				type: Sequelize.ENUM("pending", "complete", "failed")
			},
			deploymentStatus: {
				type: Sequelize.ENUM("pending", "complete", "failed")
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
				allowNull: false
			},
			createdAt: {
				type: Sequelize.DATE,
				allowNull: false
			}
		});

		await queryInterface.addIndex(tableName, {
			fields: ['subscriptionId', 'repoId'],
			name: indexName
		})
	},
	down: async (queryInterface, Sequelize) => {
		await queryInterface.removeIndex(tableName, indexName);
		await queryInterface.dropTable(tableName);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_branchStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_commitStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_issueStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_pullStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_buildStatus";`);
		await queryInterface.sequelize.query(`DROP TYPE "enum_${tableName}_deploymentStatus";`);
	}
};
