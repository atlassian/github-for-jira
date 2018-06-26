const Sequelize = require('sequelize')
const EncryptedField = require('sequelize-encrypted')

if (!process.env.STORAGE_SECRET) {
  throw new Error('STORAGE_SECRET is not defined.')
}

const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET)

module.exports = class Installation extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    return super.init({
      jiraHost: DataTypes.STRING,
      secrets: encrypted.vault('secrets'),
      sharedSecret: encrypted.field('sharedSecret', {
        type: DataTypes.STRING
      })
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
