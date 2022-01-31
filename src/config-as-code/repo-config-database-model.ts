import Sequelize, { DataTypes } from "sequelize";
import { sequelize } from "../models/sequelize";
import { RepoConfig } from "./repo-config";

export default class RepoConfigDatabaseModel extends Sequelize.Model {
	githubInstallationId: number;
	repoId: number;
	config: string;

	static async saveOrUpdate(
		githubInstallationId: number,
		repoId: number,
		config: RepoConfig
	): Promise<RepoConfig | null> {

		const existingConfig: RepoConfigDatabaseModel = RepoConfigDatabaseModel.findOne({
			where: {
				githubInstallationId: githubInstallationId,
				repoId: repoId
			}
		});

		if (existingConfig) {
			existingConfig.config = JSON.stringify(config);
			existingConfig.save();
			return this.toDomainModel(existingConfig);
		} else {
			const newConfig = RepoConfigDatabaseModel.create({
				githubInstallationId: githubInstallationId,
				repoId: repoId,
				config: JSON.stringify(config)
			});
			return this.toDomainModel(newConfig);
		}
	}

	static async getForRepo(
		githubInstallationId: number,
		repoId: number
	): Promise<RepoConfig | null> {
		const model: RepoConfigDatabaseModel = RepoConfigDatabaseModel.findOne({
			where: {
				githubInstallationId: githubInstallationId,
				repoId: repoId
			}
		});

		return model
			? this.toDomainModel(model)
			: null;
	}

	private static toDomainModel(databaseModel: RepoConfigDatabaseModel): RepoConfig {
		return JSON.parse(databaseModel.config) as RepoConfig;
	}
}

RepoConfigDatabaseModel.init({
	githubInstallationId: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: false
	},
	repoId: DataTypes.INTEGER,
	config: DataTypes.JSON,
}, { sequelize });
