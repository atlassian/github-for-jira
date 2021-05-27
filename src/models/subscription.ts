import Sequelize from 'sequelize';
import {queues} from '../worker/main';
import {Job} from 'bull';

export enum SyncStatus {
	PENDING = 'PENDING',
	COMPLETE = 'COMPLETE',
	ACTIVE = 'ACTIVE',
	FAILED = 'FAILED'
}

export interface RepoSyncState {
	installationId?: string;
	jiraHost?: string;
	numberOfSyncedRepos?: number;
	repos?: Repositories;
}

export interface Repositories {
	[id: string]: {
		repository?: Repository;
		pullStatus?: string,
		branchStatus?: string,
		commitStatus?: string,
		// TODO: need to get concrete typing
		[key: string]: unknown
	}
}

export interface Repository {
	id: string;
	name: string;
	full_name: string;
	owner: { login: string },
	html_url: string;
	updated_at: number;
}

export default class Subscription extends Sequelize.Model {
	gitHubInstallationId: number;
	jiraHost: string;
	selectedRepositories: number[];
	repoSyncState: RepoSyncState;
	syncStatus: SyncStatus;
	syncWarning: string;
	jiraClientKey: string;
	updatedAt: Date;
	createdAt: Date;

	static async getAllForHost(host: string): Promise<Subscription[]> {
		return Subscription.findAll({
			where: {
				jiraHost: host,
			},
		});
	}

	static async getAllForInstallation(installationId: string): Promise<Subscription[]> {
		return Subscription.findAll({
			where: {
				gitHubInstallationId: installationId,
			},
		});
	}

	static async getAllForClientKey(clientKey: string): Promise<Subscription[]> {
		return Subscription.findAll({
			where: {
				jiraClientKey: clientKey,
			},
		});
	}

	static async getSingleInstallation(jiraHost: string, gitHubInstallationId: string): Promise<Subscription> {
		return Subscription.findOne({
			where: {
				jiraHost,
				gitHubInstallationId,
			},
		});
	}

	static async getInstallationForClientKey(clientKey: string, installationId: string): Promise<Subscription> {
		return Subscription.findOne({
			where: {
				jiraClientKey: clientKey,
				gitHubInstallationId: installationId,
			},
		});
	}

	static async install(payload: SubscriptionPayload): Promise<Subscription> {
		const [subscription] = await Subscription.findOrCreate({
			where: {
				gitHubInstallationId: payload.installationId,
				jiraHost: payload.host,
				jiraClientKey: payload.clientKey,
			},
		});

		await Subscription.findOrStartSync(subscription);

		return subscription;
	}

	static async uninstall(payload: SubscriptionPayload): Promise<void> {
		await Subscription.destroy({
			where: {
				gitHubInstallationId: payload.installationId,
				jiraHost: payload.host,
			},
		});
	}

	static async findOrStartSync(subscription: Subscription, syncType?: string): Promise<Job> {
		const {gitHubInstallationId: installationId, jiraHost} = subscription;

		const repoSyncState = subscription.get('repoSyncState');

		// If repo sync state is empty
		// start a sync job from scratch
		if (!repoSyncState || (syncType === 'full')) {
			await subscription.update({
				syncStatus: 'PENDING',
				syncWarning: '',
				repoSyncState: {
					installationId,
					jiraHost,
					repos: {},
				},
			});
			console.log('Starting Jira sync');
			return queues.discovery.add({installationId, jiraHost});
		}

		// Otherwise, just add a job to the queue for this installation
		// This will automatically pick back up from where it left off
		// if something got stuck
		return queues.installation.add({installationId, jiraHost});
	}

	/*
	 * Returns array with sync status counts. [ { syncStatus: 'COMPLETED', count: 123 }, ...]
	 */
	static async syncStatusCounts(): Promise<{ syncStatus: string, count: number }[]> {
		const [results] = await this.sequelize.query('SELECT "syncStatus", COUNT(*) FROM "Subscriptions" GROUP BY "syncStatus"');
		return results;
	}

	async uninstall(): Promise<void> {
		await this.destroy();
	}

	async resumeSync(): Promise<Job> {
		return Subscription.findOrStartSync(this);
	}

	async restartSync(): Promise<Job> {
		return Subscription.findOrStartSync(this, 'full');
	}

	// A stalled in progress sync is one that is ACTIVE but has not seen any updates in the last 15 minutes
	// This may happen when an error causes a sync to die without setting the status to 'FAILED'
	isInProgressSyncStalled(): boolean {
		if (this.syncStatus === 'ACTIVE') {
			const fifteenMinutesAgo = new Date(Date.now() - (15 * 60 * 1000));

			return this.updatedAt < fifteenMinutesAgo;
		} else {
			return false;
		}
	}
};

export interface SubscriptionPayload {
	installationId: string;
	host: string;
	clientKey: string;
}
