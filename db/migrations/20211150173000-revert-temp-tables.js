"use strict";

const repoTableName = "RepoSyncStates";
const subTableName = "Subscriptions";
module.exports = {
	up: async (queryInterface, Sequelize) => {
		try {
			await Promise.any([
				queryInterface.removeIndex(repoTableName, `${repoTableName}_subscriptionId_repoId_idx`),
				queryInterface.sequelize.query(`DROP TYPE "enum_${repoTableName}_status";`),
				queryInterface.sequelize.query(`DROP TYPE "enum_${repoTableName}_branchStatus";`),
				queryInterface.sequelize.query(`DROP TYPE "enum_${repoTableName}_commitStatus";`),
				queryInterface.sequelize.query(`DROP TYPE "enum_${repoTableName}_issueStatus";`),
				queryInterface.sequelize.query(`DROP TYPE "enum_${repoTableName}_pullStatus";`),
				queryInterface.sequelize.query(`DROP TYPE "enum_${repoTableName}_buildStatus";`),
				queryInterface.sequelize.query(`DROP TYPE "enum_${repoTableName}_deploymentStatus";`),
				queryInterface.dropTable(repoTableName),
				queryInterface.dropTable("MichelTestTable"),
				queryInterface.dropTable("MichelTestTable2"),
				queryInterface.dropTable("MichelTestTable3"),
				queryInterface.dropTable("WojtekTestTable"),
				queryInterface.sequelize.query(`delete from "SequelizeMeta" where name = '20211110150400-create-sync-state-table.js' OR name = '20211110173000-add-extra-subscription-columns.js' OR name = '20211110150400-revert-sync-table.js' OR name = '20211150173000-create-test-table.js' OR name = '20211150173000-create-test-table-2.js' OR name = '20211150173000-create-test-table-3.js'`),
				queryInterface.removeColumn(subTableName, 'rateLimitRemaining'),
				queryInterface.removeColumn(subTableName, 'rateLimitReset'),
				queryInterface.removeColumn(subTableName, 'numberOfSyncedRepos'),
			])
		}catch(e) {

		}
	},
};
