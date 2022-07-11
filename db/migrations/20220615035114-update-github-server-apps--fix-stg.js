"use strict";

const tableName = "GitHubServerApps";

module.exports = {
  up: (queryInterface, Sequelize) => {
    return queryInterface.addColumn(tableName, 'secrets', Sequelize.BLOB)
  },

  down: (queryInterface, Sequelize) => {
    return queryInterface.removeColumn(tableName, 'secrets')
  }
};
