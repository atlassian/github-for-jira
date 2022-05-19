import { Model, DataTypes } from "sequelize";
import {encrypted, getHashedKey, sequelize} from "models/sequelize";
import {Subscription} from "models/subscription";

interface GitHubServerAppPayload {
	uuid: string;
	githubBaseUrl: string;
	githubClientId: string;
	secrets: string;
}

export class GitHubServerApp extends Model {
	id: number;
	uuid: string;
	githubBaseUrl: string;
	githubClientId: string;
	secrets: string;
	githubClientSecret: string;
	webhookSecret: string;
	privateKey: string;

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
	 * @param {{host: string, clientKey: string, secret: string}} payload
	 * @returns {GitHubServerApp}
	 */
	static async install(payload: GitHubServerAppPayload): Promise<GitHubServerApp> {
		const { uuid, githubBaseUrl, githubClientId, secrets } = payload;
		const [gitHubServerApp] = await this.create({
			uuid,
			githubBaseUrl,
			githubClientId,
			secrets,
		});

		return gitHubServerApp;
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

