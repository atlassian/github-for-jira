const Sequelize = require('sequelize')

module.exports = class Installation extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    return super.init({
      jiraHost: DataTypes.STRING,
      sharedSecret: DataTypes.STRING
    }, { sequelize })
  }

  static async getForHost (host) {
    return Installation.findOne({
      where: {
        jiraHost: host
      }
    })
  }

  static async install (payload) {
    const [installation, created] = await Installation.findOrCreate({
      where: {
        jiraHost: payload.host
      },
      defaults: {
        jiraHost: payload.host,
        sharedSecret: payload.sharedSecret
      }
    })

    if (!created) {
      await installation.update({
        sharedSecret: payload.sharedSecret
      })
    }

    return installation
  }

  static async uninstall (payload) {
    return Installation.destroy({
      where: {
        jiraHost: payload.host
      }
    })
  }
}
