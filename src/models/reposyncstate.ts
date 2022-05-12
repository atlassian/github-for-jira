import { BOOLEAN, CountOptions, DataTypes, DATE, DestroyOptions, FindOptions, INTEGER, Model, Op, STRING } from "sequelize";
import { Subscription, Repositories, RepositoryData, RepoSyncStateObject, TaskStatus } from "./subscription";
import { merge, pickBy } from "lodash";
import { sequelize } from "models/sequelize";

export class RepoSyncState extends Model {
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

	get status(): TaskStatus {
		const statuses = [this.pullStatus, this.branchStatus, this.commitStatus];
		if (statuses.some(s => s === "failed")) {
			return "failed";
		}

		if (statuses.every(s => s === "complete")) {
			return "complete";
		}

		return "pending";
	}

	static async countSyncedReposFromSubscription(subscription: Subscription): Promise<number> {
		return RepoSyncState.countFromSubscription(subscription, {
			where: {
				pullStatus: "complete",
				branchStatus: "complete",
				commitStatus: "complete"
			}
		});
	}

	static async countFailedReposFromSubscription(subscription: Subscription): Promise<number> {
		return RepoSyncState.countFromSubscription(subscription, {
			where: {
				[Op.or]: {
					pullStatus: "failed",
					branchStatus: "failed",
					commitStatus: "failed"
				}
			}
		});
	}

	static async countFromSubscription(subscription: Subscription, options: CountOptions = {}): Promise<number> {
		return RepoSyncState.count(merge(options, {
			where: {
				subscriptionId: subscription.id
			}
		}));
	}

	static async findAllFromSubscription(subscription: Subscription, options: FindOptions = {}): Promise<RepoSyncState[]> {
		return RepoSyncState.findAll(merge(options, {
			where: {
				subscriptionId: subscription.id
			}
		}));
	}

	static async findOneFromSubscription(subscription: Subscription, options: FindOptions = {}): Promise<RepoSyncState> {
		return RepoSyncState.findOne(merge(options, {
			where: {
				subscriptionId: subscription.id
			},
			order: [["repoUpdatedAt", "DESC"]]
		} as FindOptions));
	}

	static async deleteFromSubscription(subscription: Subscription, options: DestroyOptions = {}): Promise<number> {
		return RepoSyncState.destroy(merge(options, {
			where: {
				subscriptionId: subscription.id
			}
		}));
	}

	// Nullify statuses and cursors to start anew
	static async resetSyncFromSubscription(subscription: Subscription): Promise<[number, RepoSyncState[]]> {
		return RepoSyncState.update({
			repoUpdatedAt: null,
			branchStatus: null,
			branchCursor: null,
			commitStatus: null,
			commitCursor: null,
			pullStatus: null,
			pullCursor: null
		}, {
			where: {
				subscriptionId: subscription.id
			}
		});
	}

	static async updateFromRepoJson(subscription: Subscription, json: RepoSyncStateObject = {}): Promise<RepoSyncState[]> {
		const repoIds = Object.keys(json.repos || {});

		// Get states that are already in DB
		const states: RepoSyncState[] = await RepoSyncState.findAll({
			where: {
				subscriptionId: subscription.id,
				repoId: {
					[Op.in]: repoIds
				}
			}
		});

		return RepoSyncState.sequelize?.transaction(async (transaction) => {
			// Delete all repos that's not in state anymore
			await RepoSyncState.destroy({
				where: {
					subscriptionId: subscription.id,
					repoId: {
						[Op.notIn]: repoIds
					}
				},
				transaction
			});

			return Promise.all(
				repoIds.map(id => {
					const repo = json.repos?.[id];
					const model = states.find(s => s.repoId === Number(id)) || RepoSyncState.buildFromRepositoryData(subscription, repo);
					return model?.setFromRepositoryData(repo).save({ transaction });
				})
			);
		});
	}

	static async toRepoJson(subscription: Subscription): Promise<RepoSyncStateObject> {
		const repos = await RepoSyncState.findAllFromSubscription(subscription);
		return {
			installationId: subscription.gitHubInstallationId,
			jiraHost: subscription.jiraHost,
			numberOfSyncedRepos: await RepoSyncState.countSyncedReposFromSubscription(subscription),
			repos: repos.reduce<Repositories>((acc, repo) => {
				acc[repo.repoId] = repo.toRepositoryData();
				return acc;
			}, {})
		};
	}

	static buildFromRepositoryData(subscription: Subscription, repo?: RepositoryData): RepoSyncState | undefined {
		const repoId = Number(repo?.repository?.id);
		if (!repoId) {
			return undefined;
		}
		return RepoSyncState.build({
			repoId,
			subscriptionId: subscription.id,
			repoName: repo?.repository?.name,
			repoOwner: repo?.repository?.owner?.login,
			repoFullName: repo?.repository?.full_name,
			repoUrl: repo?.repository?.html_url
		});
	}

	// TODO: need to redo this in a better fashion
	static async updateRepoForSubscription(subscription: Subscription, repoId: number, key: keyof RepositoryData, value: unknown): Promise<RepoSyncState | undefined> {
		const model: RepoSyncState | undefined = await RepoSyncState.findOne({
			where: {
				subscriptionId: subscription.id,
				repoId
			}
		});
		const repo = merge(model?.toRepositoryData() || {}, {
			[key]: value
		});
		return model?.setFromRepositoryData(repo)?.save();
	}

	// TODO: revert this back to not using 'lastSomethingCursor'
	setFromRepositoryData(repo?: RepositoryData): RepoSyncState {
		if (repo) {
			this.repoUpdatedAt = new Date(repo.repository?.updated_at ?? Date.now());
			this.branchStatus = repo.branchStatus;
			this.branchCursor = repo.lastBranchCursor;
			this.commitStatus = repo.commitStatus;
			this.commitCursor = repo.lastCommitCursor;
			this.pullStatus = repo.pullStatus;
			this.pullCursor = repo.lastPullCursor?.toString();
		}
		return this;
	}

	toRepositoryData(): RepositoryData {
		return pickBy<RepositoryData>({
			repository: {
				id: this.repoId,
				name: this.repoName,
				full_name: this.repoFullName,
				owner: {
					login: this.repoOwner
				},
				html_url: this.repoUrl,
				// eslint-disable-next-line @typescript-eslint/no-explicit-any
				updated_at: (this.repoUpdatedAt ?? new Date(0)) as any
			},
			pullStatus: this.pullStatus,
			lastPullCursor: this.pullCursor ? Number(this.pullCursor) : undefined,
			commitStatus: this.commitStatus,
			lastCommitCursor: this.commitCursor,
			branchStatus: this.branchStatus,
			lastBranchCursor: this.branchCursor
		});
	}
}

RepoSyncState.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
	subscriptionId: {
		type: DataTypes.INTEGER,
		allowNull: false
	},
	repoId: {
		type: INTEGER,
		allowNull: false
	},
	repoName: {
		type: STRING,
		allowNull: false
	},
	repoOwner: {
		type: STRING,
		allowNull: false
	},
	repoFullName: {
		type: STRING,
		allowNull: false
	},
	repoUrl: {
		type: STRING,
		allowNull: false
	},
	priority: INTEGER,
	branchStatus: DataTypes.ENUM("pending", "complete", "failed"),
	commitStatus: DataTypes.ENUM("pending", "complete", "failed"),
	issueStatus: DataTypes.ENUM("pending", "complete", "failed"),
	pullStatus: DataTypes.ENUM("pending", "complete", "failed"),
	buildStatus: DataTypes.ENUM("pending", "complete", "failed"),
	deploymentStatus: DataTypes.ENUM("pending", "complete", "failed"),
	branchCursor: STRING,
	commitCursor: STRING,
	issueCursor: STRING,
	pullCursor: STRING,
	buildCursor: STRING,
	deploymentCursor: STRING,
	forked: BOOLEAN,
	repoPushedAt: DATE,
	repoUpdatedAt: DATE,
	repoCreatedAt: DATE,
	syncUpdatedAt: DATE,
	syncCompletedAt: DATE,
	createdAt: DATE,
	updatedAt: DATE
}, { sequelize });
