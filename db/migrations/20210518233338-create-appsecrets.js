
module.exports = {
  up: (queryInterface, Sequelize) => queryInterface.createTable('AppSecrets', {
    id: {
      allowNull: false,
      autoIncrement: true,
      primaryKey: true,
      type: Sequelize.INTEGER,
    },
    githubHost: {
      allowNull: false,
      type: Sequelize.STRING,
    },
    clientId: {
      allowNull: false,
      type: Sequelize.STRING,
    },
    clientSecret: {
      allowNull: false,
      type: Sequelize.BLOB,
    },
    privateKey: {
      allowNull: false,
      type: Sequelize.BLOB,
    },
    appId: {
      allowNull: false,
      type: Sequelize.INTEGER,
    },
    webhookSecret: {
      allowNull: false,
      type: Sequelize.BLOB,
    },
    createdAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
    updatedAt: {
      allowNull: false,
      type: Sequelize.DATE,
    },
  }).then(() => queryInterface.addIndex('AppSecrets', ['githubHost'])),
  down: (queryInterface, Sequelize) => queryInterface.dropTable('AppSecrets').then(() => queryInterface.removeIndex('AppSecrets', ['githubHost'])),
};
