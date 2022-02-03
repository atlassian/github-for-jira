import Sequelize, { DataTypes } from "sequelize";
import { sequelize } from "../models/sequelize";
import { RepoConfig } from "./repo-config";

export default class RepoConfigDatabaseModel extends Sequelize.Model {
	id: number;
	githubInstallationId: number;
	repoId: number;
	config: RepoConfig;
	createdAt: Date;
	updatedAt: Date;

	static async saveOrUpdate(
		githubInstallationId: number,
		repoId: number,
		config: RepoConfig
	): Promise<RepoConfig | null> {

		const existingConfig: RepoConfigDatabaseModel = await RepoConfigDatabaseModel.findOne({
			where: {
				githubInstallationId: githubInstallationId,
				repoId: repoId
			}
		});

		if (existingConfig) {
			existingConfig.config = config;
			await existingConfig.save();
			return this.toDomainModel(existingConfig);
		} else {
			const newConfig = await RepoConfigDatabaseModel.create({
				githubInstallationId: githubInstallationId,
				repoId: repoId,
				config: config
			});
			return this.toDomainModel(newConfig);
		}
	}

	static async getForRepo(
		githubInstallationId: number,
		repoId: number
	): Promise<RepoConfig | null> {
		const model: RepoConfigDatabaseModel = await RepoConfigDatabaseModel.findOne({
			where: {
				githubInstallationId: githubInstallationId,
				repoId: repoId
			}
		});

		return model
			? this.toDomainModel(model)
			: null;
	}

	static async deleteForRepo(
		githubInstallationId: number,
		repoId: number
	) {
		await RepoConfigDatabaseModel.destroy({
			where: {
				githubInstallationId: githubInstallationId,
				repoId: repoId
			}
		});
	}

	static async deleteForInstallation(
		githubInstallationId: number
	) {
		await RepoConfigDatabaseModel.destroy({
			where: {
				githubInstallationId: githubInstallationId,
			}
		});
	}

	private static toDomainModel(databaseModel: RepoConfigDatabaseModel): RepoConfig {
		return databaseModel.config;
	}

}

RepoConfigDatabaseModel.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
	githubInstallationId: DataTypes.INTEGER,
	repoId: DataTypes.INTEGER,
	config: DataTypes.JSON,
	createdAt: DataTypes.DATE,
	updatedAt: DataTypes.DATE
}, {
	tableName: "RepoConfigs",
	sequelize
});

