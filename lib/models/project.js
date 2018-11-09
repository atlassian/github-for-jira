const Sequelize = require('sequelize')

module.exports = class Project extends Sequelize.Model {
  static init (sequelize, DataTypes) {
    return super.init(
      {
        projectKey: DataTypes.STRING,
        occurrences: DataTypes.INTEGER,
        jiraHost: DataTypes.STRING
      },
      { sequelize }
    )
  }

  static async getAllForHost (host) {
    return Project.findAll({
      where: {
        jiraHost: host
      }
    })
  }

  static async getProjectForHost (project, host) {
    return Project.findOne({
      where: {
        projectKey: project,
        jiraHost: host
      }
    })
  }

  static async upsert (projectKey, jiraHost) {
    const [project] = await Project.findOrCreate({
      where: { projectKey, jiraHost }
    })

    await project.increment('occurrences', { by: 1 })

    return project
  }

  static async removeAllForHost (host) {
    const projects = await Project.findAll({
      where: {
        jiraHost: host
      }
    })

    for (const project of projects) {
      project.delete()
    }
  }

  async delete () {
    return this.destroy()
  }
}
