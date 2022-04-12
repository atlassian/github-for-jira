import { DataTypes, DATE, Model, Op, WhereOptions } from "sequelize";
import { RepoSyncState } from "./reposyncstate";
import { merge, uniq } from "lodash";
import { sequelize } from "models/sequelize";

export enum SyncStatus {
	PENDING = "PENDING",
	COMPLETE = "COMPLETE",
	ACTIVE = "ACTIVE",
	FAILED = "FAILED",
}

export interface RepoSyncStateObject {
	installationId?: number;
	jiraHost?: string;
	numberOfSyncedRepos?: number;
	repos?: Repositories;
}

interface SyncStatusCount {
	syncStatus: string;
	count: number;
}

export interface Repositories {
	[id: string]: RepositoryData;
}

export interface RepositoryData {
	repository?: Repository;
	pullStatus?: TaskStatus;
	branchStatus?: TaskStatus;
	commitStatus?: TaskStatus;
	buildStatus?: TaskStatus;
	deploymentStatus?: TaskStatus;
	lastBranchCursor?: string;
	lastCommitCursor?: string;
	lastPullCursor?: number;
	lastBuildCursor?: string;
	lastDeploymentCursor?: string;

	// TODO: need to get concrete typing
	[key: string]: unknown;
}

export type TaskStatus = "pending" | "complete" | "failed";

export interface Repository {
	id: string;
	name: string;
	full_name: string;
	owner: { login: string };
	html_url: string;
	updated_at: number; // TODO: is this a date object or a timestamp?  Different places uses different things
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
	numberOfSyncedRepos?: number;

	static async getAllForHost(host: string): Promise<Subscription[]> {
		return this.findAll({
			where: {
				jiraHost: host
			}
		});
	}

	static getAllForInstallation(
		installationId: number
	): Promise<Subscription[]> {
		return this.findAll({
			where: {
				gitHubInstallationId: installationId
			}
		});
	}

	static getAllFiltered(
		installationIds: number[] = [],
		statusTypes: string[] = ["FAILED", "PENDING", "ACTIVE"],
		offset = 0,
		limit?: number,
		inactiveForSeconds?: number
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
		gitHubInstallationId: number
	): Promise<Subscription | null> {
		return this.findOne({
			where: {
				jiraHost,
				gitHubInstallationId
			}
		});
	}

	static async getInstallationForClientKey(
		clientKey: string,
		installationId: string
	): Promise<Subscription | null> {
		return this.findOne({
			where: {
				jiraClientKey: clientKey,
				gitHubInstallationId: installationId
			}
		});
	}

	static async install(payload: SubscriptionInstallPayload): Promise<Subscription> {
		const [subscription] = await this.findOrCreate({
			where: {
				gitHubInstallationId: payload.installationId,
				jiraHost: payload.host,
				jiraClientKey: payload.clientKey
			}
		});

		return subscription;
	}

	static async uninstall(payload: SubscriptionPayload): Promise<void> {
		await this.destroy({
			where: {
				gitHubInstallationId: payload.installationId,
				jiraHost: payload.host
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

	// This is a workaround to fix a long standing bug in sequelize for JSON data types
	// https://github.com/sequelize/sequelize/issues/4387
	async updateSyncState(updatedState: RepoSyncStateObject): Promise<Subscription> {
		const state = merge(await RepoSyncState.toRepoJson(this), updatedState);
		await RepoSyncState.updateFromRepoJson(this, state);
		return this;
	}

	async updateRepoSyncStateItem(repositoryId: string, key: keyof RepositoryData, value: unknown) {
		await RepoSyncState.updateRepoForSubscription(this, Number(repositoryId), key, value);
		return this;
	}

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
	createdAt: DATE,
	updatedAt: DATE
}, { sequelize });

export interface SubscriptionPayload {
	installationId: number;
	host: string;
}

export interface SubscriptionInstallPayload extends SubscriptionPayload {
	clientKey: string;
}
