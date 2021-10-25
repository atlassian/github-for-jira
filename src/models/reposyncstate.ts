import Sequelize, { Op } from "sequelize";
import Subscription, { RepositoryData, RepoSyncStateObject, TaskStatus } from "./subscription";

export default class RepoSyncState extends Sequelize.Model {
	id: number;
	subscriptionId: number;
	repoId: number;
	repoName: string;
	repoOwner: string;
	repoFullName: string;
	repoUrl: string;
	priority?: number;
	branchStatus?: TaskStatus;
	commitStatus?: TaskStatus;
	issueStatus?: TaskStatus;
	pullStatus?: TaskStatus;
	buildStatus?: TaskStatus;
	deploymentStatus?: TaskStatus;
	branchCursor?: string;
	commitCursor?: string;
	issueCursor?: string;
	pullCursor?: string;
	buildCursor?: string;
	deploymentCursor?: string;
	forked?: boolean;
	repoPushedAt?: Date;
	repoUpdatedAt?: Date;
	repoCreatedAt?: Date;
	syncUpdatedAt?: Date;
	syncCompletedAt?: Date;
	updatedAt: Date;
	createdAt: Date;

	static async getAllReposForSubscription(subscription: Subscription): Promise<RepoSyncState[]> {
		return RepoSyncState.findAll({
			where: {
				subscriptionId: subscription.id
			}
		});
	}

	static async deleteAllStateFromSubscription(subscription: Subscription): Promise<number> {
		return RepoSyncState.destroy({
			where: {
				subscriptionId: subscription.id
			}
		});
	}

	static async updateFromJson(subscription: Subscription, json: RepoSyncStateObject): Promise<RepoSyncState[]> {
		const repoIds = Object.keys(json.repos || {});

		if (repoIds.length) {
			// Delete all repos that's not in repoSyncState
			await RepoSyncState.destroy({
				where: {
					subscriptionId: subscription.id,
					repoId: {
						[Op.notIn]: repoIds
					}
				}
			});
		}

		const states: RepoSyncState[] = await RepoSyncState.findAll({
			where: {
				subscriptionId: subscription.id,
				repoId: {
					[Op.in]: repoIds
				}
			}
		});


		return RepoSyncState.sequelize?.transaction(async (transaction) =>
			Promise.all(
				repoIds.map(id => {
					const repo = json.repos?.[id];
					const model = states.find(s => s.repoId === Number(id)) || RepoSyncState.buildFromRepoJson(subscription, repo);
					return model?.setFromRepoJson(repo).save({ transaction });
				})
			)
		);
	}

	static buildFromRepoJson(subscription: Subscription, repo?: RepositoryData): RepoSyncState | undefined {
		const repoId = repo?.repository?.id;
		if (!repoId) {
			return undefined;
		}
		return RepoSyncState.build({
			repoId,
			subscriptionId: subscription.id,
			repoName: repo?.repository?.name,
			repoOwner: repo?.repository?.owner,
			repoFullName: repo?.repository?.full_name,
			repoUrl: repo?.repository?.html_url
		});
	}

	setFromRepoJson(repo?: RepositoryData): RepoSyncState {
		if (repo) {
			this.repoUpdatedAt = new Date(repo.repository?.updated_at || Date.now());
			this.branchStatus = repo.branchStatus;
			this.branchCursor = repo.lastBranchCursor;
			this.commitStatus = repo.commitStatus;
			this.commitCursor = repo.lastCommitCursor;
			this.pullStatus = repo.pullStatus;
			this.pullCursor = repo.lastPullCursor?.toString();
		}
		return this;
	}

	static async updateRepoForSubscription(subscription: Subscription, repo?: RepositoryData): Promise<RepoSyncState | undefined> {
		const repoId = repo?.repository?.id;
		if (!repoId) {
			return undefined;
		}
		const model: RepoSyncState | undefined = await RepoSyncState.findOne({
			where: {
				subscriptionId: subscription.id,
				repoId
			}
		});
		return model?.setFromRepoJson(repo)?.save();
	}
}
