const Sequelize = require('sequelize')

module.exports = class Subscription extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    return super.init({
      gitHubInstallationId: DataTypes.INTEGER,
      jiraHost: DataTypes.STRING
    }, { sequelize })
  }

  static async getAllForHost (host) {
    return Subscription.findAll({
      where: {
        jiraHost: host
      }
    })
  }

  static async getAllForInstallation (installationId) {
    return Subscription.findAll({
      where: {
        gitHubInstallationId: installationId
      }
    })
  }

  static async install (payload) {
    const [subscription] = await Subscription.findOrCreate({
      where: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host
      }
    })

    return subscription
  }

  static async uninstall (payload) {
    return Subscription.destroy({
      where: {
        gitHubInstallationId: payload.installationId,
        jiraHost: payload.host
      }
    })
  }

  async uninstall() {
    return this.destroy()
  }
}
