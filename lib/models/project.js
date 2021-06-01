const Sequelize = require('sequelize');

module.exports = class Project extends Sequelize.Model {
  static init(sequelize, DataTypes) {
    return super.init(
      {
        projectKey: DataTypes.STRING,
        occurrences: DataTypes.INTEGER,
        jiraHost: DataTypes.STRING,
      },
      { sequelize },
    );
  }

  static getAllForHost(host) {
    return Project.findAll({
      where: {
        jiraHost: host,
      },
    });
  }

  static getProjectForHost(project, host) {
    return Project.findOne({
      where: {
        projectKey: project,
        jiraHost: host,
      },
    });
  }

  static async upsert(projectKey, jiraHost) {
    try {
      const [project] = await Project.findOrCreate({
        where: { projectKey, jiraHost },
      });

      await project.increment('occurrences', { by: 1 });

      return project;
    } catch (err) {
      logger.error(`Error upserting project: ${err}`);
    }
  }

  static async removeAllForHost(host) {
    try {
      const projects = await Project.findAll({
        where: {
          jiraHost: host,
        },
      });

      for (const project of projects) {
        project.delete();
      }
    } catch (err) {
      logger.error(`Error removing from host: ${err}`);
    }
  }

  async delete() {
    return this.destroy();
  }
};
