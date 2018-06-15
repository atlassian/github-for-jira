const Sequelize = require('sequelize')

module.exports = class Subscription extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    return super.init({
      gitHubInstallationId: DataTypes.INTEGER,
      jiraHost: DataTypes.STRING
    }, { sequelize })
  }

  static async getAllForHost (host) {
    return Subscription.find({
      where: {
        jiraHost: host
      }
    })
  }

  static async create (payload) {
    const [subscription] = await Subscription.findOrCreate({
      where: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host
      },
      defaults: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host
      }
    })

    return subscription
  }

  static async remove (payload) {
    return Subscription.destroy({
      where: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host
      }
    })
  }
}
