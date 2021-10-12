"use strict";

const tableName = "RepoSyncState";
module.exports = {
	up: (queryInterface, Sequelize) => {
		return queryInterface.createTable(tableName, {
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
			commitCount: {
				type: Sequelize.INTEGER
			},
			branchCount: {
				type: Sequelize.INTEGER
			},
			issueCount: {
				type: Sequelize.INTEGER
			},
			pullCount: {
				type: Sequelize.INTEGER
			},
			buildCount: {
				type: Sequelize.INTEGER
			},
			deploymentCount: {
				type: Sequelize.INTEGER
			},
			watchCount: {
				type: Sequelize.INTEGER
			},
			starCount: {
				type: Sequelize.INTEGER
			},
			forkCount: {
				type: Sequelize.INTEGER
			},
			popularity: {
				type: Sequelize.INTEGER
			},
			status: {
				type: Sequelize.STRING
			},
			branchStatus: {
				type: Sequelize.STRING
			},
			commitStatus: {
				type: Sequelize.STRING
			},
			issueStatus: {
				type: Sequelize.STRING
			},
			pullStatus: {
				type: Sequelize.STRING
			},
			buildStatus: {
				type: Sequelize.STRING
			},
			deploymentStatus: {
				type: Sequelize.STRING
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
			archived: {
				type: Sequelize.BOOLEAN
			},
			disabled: {
				type: Sequelize.BOOLEAN
			},
			pushedAt: {
				type: Sequelize.DATE
			},
			createdAt: {
				allowNull: false,
				type: Sequelize.DATE
			},
			updatedAt: {
				allowNull: false,
				type: Sequelize.DATE
			}
		});
	},
	down: (queryInterface, Sequelize) => {
		return queryInterface.dropTable(tableName);
	}
};
