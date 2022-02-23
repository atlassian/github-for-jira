import Sequelize, { Op, WhereOptions } from "sequelize";
import _ from "lodash";
import RepoSyncState from "./reposyncstate";

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
	lastBranchCursor?: string;
	lastCommitCursor?: string;
	lastPullCursor?: number;

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

export default class Subscription extends Sequelize.Model {
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
		return Subscription.findAll({
			where: {
				jiraHost: host
			}
		});
	}

	static getAllForInstallation(
		installationId: number
	): Promise<Subscription[]> {
		return Subscription.findAll({
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
					[Op.in]: _.uniq(installationIds)
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

		return Subscription.findAll({
			where: {
				[Op.and]: andFilter
			},
			limit,
			offset,
			order: [["updatedAt", "DESC"]]
		});
	}

	static getAllForClientKey(clientKey: string): Promise<Subscription[]> {
		return Subscription.findAll({
			where: {
				jiraClientKey: clientKey
			}
		});
	}

	static getSingleInstallation(
		jiraHost: string,
		gitHubInstallationId: number
	): Promise<Subscription | null> {
		return Subscription.findOne({
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
		return Subscription.findOne({
			where: {
				jiraClientKey: clientKey,
				gitHubInstallationId: installationId
			}
		});
	}

	static async install(payload: SubscriptionInstallPayload): Promise<Subscription> {
		const [subscription] = await Subscription.findOrCreate({
			where: {
				gitHubInstallationId: payload.installationId,
				jiraHost: payload.host,
				jiraClientKey: payload.clientKey
			}
		});

		return subscription;
	}

	static async uninstall(payload: SubscriptionPayload): Promise<void> {
		await Subscription.destroy({
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
		const [results] = await this.sequelize?.query(
			`SELECT "syncStatus", COUNT(*)
			 FROM "Subscriptions"
			 GROUP BY "syncStatus"`
		);
		return results as SyncStatusCount[];
	}

	// This is a workaround to fix a long standing bug in sequelize for JSON data types
	// https://github.com/sequelize/sequelize/issues/4387
	async updateSyncState(updatedState: RepoSyncStateObject): Promise<Subscription> {

		// Zero repos, means zero syncs required so set COMPLETE.
		if (!updatedState?.repos) {
			await this.update({
				syncStatus: SyncStatus.COMPLETE
			});
		}

		const state = _.merge(await RepoSyncState.toRepoJson(this), updatedState);
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

export interface SubscriptionPayload {
	installationId: number;
	host: string;
}

export interface SubscriptionInstallPayload extends SubscriptionPayload {
	clientKey: string;
}
