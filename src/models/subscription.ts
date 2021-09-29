import Sequelize, { Op, WhereOptions } from "sequelize";
import { Job } from "bull";
import _ from "lodash";
import logger from "../config/logger";
import { queues } from "../worker/queues";

export enum SyncStatus {
	PENDING = "PENDING",
	COMPLETE = "COMPLETE",
	ACTIVE = "ACTIVE",
	FAILED = "FAILED",
}

export interface RepoSyncState {
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

export type TaskStatus = "pending" | "complete";

export interface Repository {
	id: string;
	name: string;
	full_name: string;
	owner: { login: string };
	html_url: string;
	updated_at: number; // TODO: is this a date object or a timestamp?  Different places uses different things
}

export default class Subscription extends Sequelize.Model {
	gitHubInstallationId: number;
	jiraHost: string;
	selectedRepositories?: number[];
	repoSyncState?: RepoSyncState;
	syncStatus?: SyncStatus;
	syncWarning?: string;
	jiraClientKey: string;
	updatedAt: Date;
	createdAt: Date;

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
		limit?: number
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

	static async install(payload: SubscriptionPayload): Promise<Subscription> {
		const [subscription] = await Subscription.findOrCreate({
			where: {
				gitHubInstallationId: payload.installationId,
				jiraHost: payload.host,
				jiraClientKey: payload.clientKey
			}
		});

		await Subscription.findOrStartSync(subscription);

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

	static async findOrStartSync(
		subscription: Subscription,
		syncType?: string
	): Promise<Job> {
		const { gitHubInstallationId: installationId, jiraHost } = subscription;

		// If repo sync state is empty
		// start a sync job from scratch
		if (!subscription.repoSyncState || syncType === "full") {
			subscription.changed("repoSyncState", true);
			await subscription.update({
				syncStatus: "PENDING",
				syncWarning: "",
				repoSyncState: {
					installationId,
					jiraHost,
					repos: {}
				}
			});
			logger.info("Starting Jira sync");
			return queues.discovery.add({ installationId, jiraHost });
		}

		// Otherwise, just add a job to the queue for this installation
		// This will automatically pick back up from where it left off
		// if something got stuck
		return queues.installation.add({ installationId, jiraHost });
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
	async updateSyncState(updatedState: RepoSyncState): Promise<Subscription> {
		this.repoSyncState = _.merge(this.repoSyncState, updatedState);
		this.changed("repoSyncState", true);
		return this.save();
	}

	async updateNumberOfSyncedRepos(cnt: number): Promise<Subscription> {
		if (!this.repoSyncState) {
			this.repoSyncState = {};
			this.changed("repoSyncState", true);
			await this.save();
		}

		this.repoSyncState.numberOfSyncedRepos = cnt;
		await this.sequelize.query(
			"UPDATE \"Subscriptions\" SET \"repoSyncState\" = jsonb_set(\"repoSyncState\", '{numberOfSyncedRepos}', ':cnt', true) WHERE id = :id",
			{
				replacements: {
					cnt: cnt,
					id: (this as any).id
				}
			}
		);
		return this;
	}

	async updateRepoSyncStateItem(repositoryId: string, key: keyof RepositoryData, value: string) {
		this.repoSyncState = _.merge(this.repoSyncState, {
			repos: {
				[repositoryId]: {
					[key]: value
				}
			}
		});

		await this.sequelize.query(
			"UPDATE \"Subscriptions\" SET \"repoSyncState\" = jsonb_set(\"repoSyncState\", :path, :value, true) WHERE id = :id",
			{
				replacements: {
					path: `{repos,${repositoryId},${key}}`,
					value: JSON.stringify(value),
					id: (this as any).id
				}
			}
		);
		return this;
	}

	async uninstall(): Promise<void> {
		await this.destroy();
	}

	// An IN PROGRESS sync is one that is ACTIVE but has not seen any updates in the last 15 minutes.
	// This may happen when an error causes a sync to die without setting the status to 'FAILED'
	hasInProgressSyncFailed(): boolean {
		if (this.syncStatus === "ACTIVE") {
			const fifteenMinutesAgo = new Date(Date.now() - 15 * 60 * 1000);

			return this.updatedAt < fifteenMinutesAgo;
		} else {
			return false;
		}
	}
}

export interface SubscriptionPayload {
	installationId: string;
	host: string;
	clientKey: string;
}
