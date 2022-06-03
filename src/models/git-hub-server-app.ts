import { Model, DataTypes, Sequelize } from "sequelize";
import { sequelize } from "models/sequelize";
import EncryptedField from "sequelize-encrypted";
const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

interface GitHubServerAppPayload {
	uuid: string;
	githubBaseUrl: string;
	githubClientId: string;
	githubClientSecret: string;
	webhookSecret: string;
	privateKey: string;
}

export class GitHubServerApp extends Model {
	id: number;
	uuid: string;
	githubBaseUrl: string;
	githubClientId: string;
	githubClientSecret: string;
	webhookSecret: string;
	privateKey: string;
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
	 * Create a new GitHubServerApp object
	 *
	 * @param {{
	 * 		uuid: string,
	 * 		githubBaseUrl:
	 * 		string,
	 * 		githubClientId: string,
	 * 		githubClientSecret: string,
	 * 		webhookSecret: string,
	 * 		privateKey: string
	 * 	}} payload
	 * @returns {GitHubServerApp}
	 */
	static async install(payload: GitHubServerAppPayload): Promise<GitHubServerApp> {
		const [gitHubServerApp] = await this.create({
			...payload
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
