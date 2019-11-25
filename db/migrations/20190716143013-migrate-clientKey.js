
module.exports = {
  up: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Subscriptions"
      SET "jiraClientKey" = (
        SELECT "clientKey"
        FROM "Installations"
        WHERE "Subscriptions"."jiraHost" =
          "Installations"."jiraHost"
        LIMIT 1
      )
      WHERE EXISTS (
        SELECT "clientKey"
        FROM "Installations"
        WHERE "Subscriptions"."jiraHost" = "Installations"."jiraHost"
      )
    `);
  },

  down: async (queryInterface) => {
    await queryInterface.sequelize.query(`
      UPDATE "Subscriptions"
      SET "jiraClientKey" = NULL
      WHERE EXISTS (
        SELECT "clientKey"
        FROM "Installations"
        WHERE "Subscriptions"."jiraHost" = "Installations"."jiraHost"
      )
    `);
  },
};
