import Sequelize, { DataTypes } from "sequelize";
import { sequelize } from "../models/sequelize";
import { Config } from "./config";

export default class ConfigDatabaseModel extends Sequelize.Model {
	githubInstallationId: number;
	config: string;

	static async getForInstallation(
		installationId: number
	): Promise<Config | null> {
		const model: ConfigDatabaseModel = ConfigDatabaseModel.findOne({
			where: {
				githubInstallationId: installationId
			}
		});

		return model
			? JSON.parse(model.config) as Config
			: null;
	}
}

ConfigDatabaseModel.init({
	subscriptionId: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: false
	},
	config: DataTypes.JSON,
}, { sequelize });
