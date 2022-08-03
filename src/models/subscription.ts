import { DataTypes, DATE, Model, Op, WhereOptions } from "sequelize";
import { uniq } from "lodash";
import { sequelize } from "models/sequelize";

export enum SyncStatus {
	PENDING = "PENDING",
	COMPLETE = "COMPLETE",
	ACTIVE = "ACTIVE",
	FAILED = "FAILED",
}

interface SyncStatusCount {
	syncStatus: string;
	count: number;
}

export type TaskStatus = "pending" | "complete" | "failed";

export interface Repository {
	id: number;
	name: string;
	full_name: string;
	owner: { login: string };
	html_url: string;
	updated_at: string; // TODO: is this a date object or a timestamp?  Different places uses different things
}

export class Subscription extends Model {
	id: number;
	gitHubInstallationId: number;
	jiraHost: string;
	selectedRepositories?: number[];
	syncStatus?: SyncStatus;
	syncWarning?: string;
	jiraClientKey: string;
	updatedAt: Date;
	createdAt: Date;
	totalNumberOfRepos?: number;
	numberOfSyncedRepos?: number;
	repositoryCursor?: string;
	repositoryStatus?: TaskStatus;
	gitHubAppId?: number;

	static async getAllForHost(jiraHost: string): Promise<Subscription[]> {
		return this.findAll({
			where: {
				jiraHost
			}
		});
	}

	static getAllForInstallation(
		gitHubInstallationId: number,
		gitHubAppId?: number
	): Promise<Subscription[]> {
		return this.findAll({
			where: {
				gitHubInstallationId,
				gitHubAppId: gitHubAppId || null
			}
		});
	}

	static findOneForGitHubInstallationId(
		gitHubInstallationId: number,
		gitHubAppId?: number
	): Promise<Subscription | null> {
		return this.findOne({
			where: {
				gitHubInstallationId,
				gitHubAppId: gitHubAppId || null
			}
		});
	}

	static getAllFiltered(
		installationIds: number[] = [],
		statusTypes: string[] = ["FAILED", "PENDING", "ACTIVE"],
		offset = 0,
		limit?: number,
		inactiveForSeconds?: number,
		gitHubAppId?: number
	): Promise<Subscription[]> {

		const andFilter: WhereOptions[] = [];

		if (statusTypes?.length > 0) {
			andFilter.push({
				syncStatus: {
					[Op.in]: statusTypes
				}
			});
		}

		if (installationIds?.length > 0) {
			andFilter.push({
				gitHubInstallationId: {
					[Op.in]: uniq(installationIds)
				}
			});
		}

		if (inactiveForSeconds) {

			const xSecondsAgo = new Date(Date.now() - (inactiveForSeconds * 1000));

			andFilter.push({
				updatedAt: {
					[Op.lt]: xSecondsAgo
				}
			});
		}

		andFilter.push({
			gitHubAppId: gitHubAppId || null
		});

		return this.findAll({
			where: {
				[Op.and]: andFilter
			},
			limit,
			offset,
			order: [["updatedAt", "DESC"]]
		});
	}

	static getAllForClientKey(clientKey: string): Promise<Subscription[]> {
		return this.findAll({
			where: {
				jiraClientKey: clientKey
			}
		});
	}

	static getSingleInstallation(
		jiraHost: string,
		gitHubInstallationId: number,
		gitHubAppId?: number
	): Promise<Subscription | null> {
		return this.findOne({
			where: {
				jiraHost,
				gitHubInstallationId,
				gitHubAppId: gitHubAppId || null
			}
		});
	}

	static async install(payload: SubscriptionInstallPayload): Promise<Subscription> {
		const [subscription] = await this.findOrCreate({
			where: {
				gitHubInstallationId: payload.installationId,
				jiraHost: payload.host,
				jiraClientKey: payload.clientKey
			},
			defaults: {
				gitHubAppId: payload.gitHubAppId
			}
		});

		return subscription;
	}

	static async uninstall(payload: SubscriptionPayload): Promise<void> {
		await this.destroy({
			where: {
				gitHubInstallationId: payload.installationId,
				jiraHost: payload.host,
				gitHubAppId: payload.gitHubAppId || null
			}
		});
	}

	/*
	 * Returns array with sync status counts. [ { syncStatus: 'COMPLETED', count: 123 }, ...]
	 */
	static async syncStatusCounts(): Promise<SyncStatusCount[]> {
		const results = await this.sequelize?.query(
			`SELECT "syncStatus", COUNT(*)
			 FROM "Subscriptions"
			 GROUP BY "syncStatus"`
		);
		return results[0] as SyncStatusCount[];
	}

	// TODO: remove this, not necessary
	async uninstall(): Promise<void> {
		await this.destroy();
	}
}

Subscription.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
	gitHubInstallationId: DataTypes.INTEGER,
	jiraHost: DataTypes.STRING,
	selectedRepositories: DataTypes.ARRAY(DataTypes.INTEGER),
	syncStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	syncWarning: DataTypes.STRING,
	jiraClientKey: DataTypes.STRING,
	numberOfSyncedRepos: DataTypes.INTEGER,
	totalNumberOfRepos: DataTypes.INTEGER,
	repositoryCursor: DataTypes.STRING,
	repositoryStatus: DataTypes.ENUM("pending", "complete", "failed"),
	createdAt: DATE,
	updatedAt: DATE,
	gitHubAppId: {
		type: DataTypes.INTEGER,
		allowNull: true
	}
}, { sequelize });

export interface SubscriptionPayload {
	installationId: number;
	host: string;
	gitHubAppId?: number;
}

export interface SubscriptionInstallPayload extends SubscriptionPayload {
	clientKey: string;
}
