module.exports = (sequelize, DataTypes) => {
  const Installation = sequelize.define('Installation', {
    jiraHost: DataTypes.STRING,
    sharedSecret: DataTypes.STRING
  }, {})

  Object.assign(Installation, {
    associate (models) {
      // associations can be defined here
    },

    async getForHost (host) {
      return this.findOne({
        where: {
          jiraHost: host
        }
      })
    },

    async install (payload) {
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
    },

    async uninstall (payload) {
      return Installation.destroy({
        where: {
          jiraHost: payload.host
        }
      })
    }
  })

  return Installation
}
