'use strict';

module.exports = {
  up: async (queryInterface, Sequelize) => {
    await queryInterface.addColumn("RepoSyncStates", "dependabotAlertFrom", { type: Sequelize.DATE, allowNull: true });
    await queryInterface.addColumn("RepoSyncStates", "dependabotAlertStatus", { type: Sequelize.ENUM("pending", "complete", "failed"), allowNull: true });
    await queryInterface.addColumn("RepoSyncStates", "dependabotAlertCursor", { type: Sequelize.STRING, allowNull: true });
  },

  down: async (queryInterface, Sequelize) => {
    await queryInterface.removeColumn("RepoSyncStates", "dependabotAlertFrom");
    await queryInterface.removeColumn("RepoSyncStates", "dependabotAlertStatus");
    await queryInterface.removeColumn("RepoSyncStates", "dependabotAlertCursor");
  }
};
