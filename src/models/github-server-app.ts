import { Model, DataTypes, Sequelize } from "sequelize";
import { sequelize } from "models/sequelize";
import EncryptedField from "sequelize-encrypted";

const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

interface GitHubServerAppPayload {
	uuid: string;
	gitHubBaseUrl: string;
	gitHubClientId: string;
	gitHubClientSecret: string;
	webhookSecret: string;
	privateKey: string;
	gitHubAppName: string;
	installationId: number;
}

export class GitHubServerApp extends Model {
	id: number;
	uuid: string;
	gitHubBaseUrl: string;
	gitHubClientId: string;
	gitHubClientSecret: string;
	webhookSecret: string;
	privateKey: string;
	gitHubAppName: string;
	installationId: number;
	updatedAt: Date;
	createdAt: Date;

	/**
	 * Get GitHubServerApp
	 *
	 * @param {{gitHubServerAppId: number}} gitHubServerAppId
	 * @returns {GitHubServerApp}
	 */
	static async getForGitHubServerAppId(
		gitHubServerAppId: number
	): Promise<GitHubServerApp | null> {
		if (!gitHubServerAppId) {
			return null;
		}

		return this.findOne({
			where: {
				id: gitHubServerAppId
			}
		});
	}

	/**
	 * Get all GitHubServerApps for gitHubBaseUrl
	 *
	 * @param {{gitHubBaseUrl: string}} gitHubBaseUrl
	 * @returns {GitHubServerApp[]}
	 */
	static async getAllForGitHubBaseUrl(
		gitHubBaseUrl: string
	): Promise<GitHubServerApp[] | null> {
		if (!gitHubBaseUrl) {
			return null;
		}

		return this.findAll({
			where: {
				gitHubBaseUrl: gitHubBaseUrl
			}
		});
	}

	/**
	 * Create a new GitHubServerApp object
	 *
	 * @param {{
	 * 		gitHubClientId: string,
	 * 		uuid: string,
	 * 		gitHubBaseUrl: string,
	 * 		gitHubClientSecret: string,
	 * 		webhookSecret: string,
	 * 		privateKey: string,
	 * 		gitHubAppName: string,
	 * 		installationId: number
	 * 	}} payload
	 * @returns {GitHubServerApp}
	 */
	static async install(payload: GitHubServerAppPayload): Promise<GitHubServerApp> {
		const {
			uuid,
			gitHubAppName,
			gitHubBaseUrl,
			gitHubClientId,
			gitHubClientSecret,
			webhookSecret,
			privateKey,
			installationId
		} = payload;

		const [gitHubServerApp] = await this.findOrCreate({
			where: {
				gitHubClientId
			},
			defaults: {
				uuid,
				gitHubBaseUrl,
				gitHubClientSecret,
				webhookSecret,
				privateKey,
				gitHubAppName,
				installationId
			}
		});

		return gitHubServerApp;
	}

	/**
	 * Get GitHubServerApp
	 *
	 * @param {{uuid: string}} uuid
	 * @returns {GitHubServerApp}
	 */
	static async findForUuid(uuid: string): Promise<GitHubServerApp | null> {
		return this.findOne({
			where: {
				uuid
			}
		});
	}
}

GitHubServerApp.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
	uuid: {
		type: DataTypes.UUID,
		defaultValue: DataTypes.UUIDV4,
		unique: true,
		allowNull: false
	},
	gitHubBaseUrl: {
		type: DataTypes.STRING,
		allowNull: false
	},
	gitHubClientId: {
		type: DataTypes.STRING,
		allowNull: false
	},
	secrets: encrypted.vault("secrets"),
	gitHubClientSecret: encrypted.field("gitHubClientSecret", {
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
	}),
	gitHubAppName: {
		type: DataTypes.STRING,
		allowNull: false
	},
	installationId: {
		type: DataTypes.INTEGER,
		allowNull: false
	}
}, { sequelize });
