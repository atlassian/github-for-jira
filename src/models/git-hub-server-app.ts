import { Model, DataTypes } from "sequelize";
import { encrypted, sequelize } from "models/sequelize";

class GitHubServerApp extends Model {}

GitHubServerApp.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
	uuid: {
		type: DataTypes.STRING,
		unique: true
	},
	githubBaseUrl: {
		type: DataTypes.STRING,
		allowNull: false
	},
	githubClientId: {
		type: DataTypes.STRING,
		allowNull: false
	},
	secrets: encrypted.vault("secrets"),
	githubClientSecret: encrypted.field("githubClientSecret", {
		type: DataTypes.STRING,
		allowNull: false
	}),
	webhookSecret: encrypted.field("webhookSecret", {
		type: DataTypes.STRING,
		allowNull: false
	}),
	privateKey: encrypted.field("privateKey", {
		type: DataTypes.STRING,
		allowNull: false
	})
}, { sequelize });
