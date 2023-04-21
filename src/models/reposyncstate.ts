import { BOOLEAN, CountOptions, CreateOptions, DataTypes, DATE, DestroyOptions, FindOptions, INTEGER, Model, Op, STRING, UpdateOptions, JSON } from "sequelize";
import { Subscription, TaskStatus } from "./subscription";
import { merge } from "lodash";
import { sequelize } from "models/sequelize";
import { Config } from "interfaces/common";

export type RepoSync = {
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
	commitFrom?: Date;
	branchFrom?: Date;
	pullFrom?: Date;
	buildFrom?: Date;
	deploymentFrom?: Date;
	forked?: boolean;
	repoPushedAt: Date;
	repoUpdatedAt: Date;
	repoCreatedAt: Date;
	syncUpdatedAt?: Date;
	syncCompletedAt?: Date;
	config?: Config;
	updatedAt: Date;
	createdAt: Date;
	failedCode?: string;
}

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
	commitFrom?: Date;
	branchFrom?: Date;
	pullFrom?: Date;
	buildFrom?: Date;
	deploymentFrom?: Date;
	forked?: boolean;
	repoPushedAt: Date;
	repoUpdatedAt: Date;
	repoCreatedAt: Date;
	syncUpdatedAt?: Date;
	syncCompletedAt?: Date;
	config?: Config;
	updatedAt: Date;
	createdAt: Date;
	failedCode?: string;

	// TODO: why it is only for pullStatus, branchStatus and commitStatus ?!
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

	static async countFullySyncedReposForSubscription(subscription: Subscription): Promise<number> {
		return RepoSyncState.countSubscriptionRepos(subscription, {
			where: {
				pullStatus: "complete",
				branchStatus: "complete",
				commitStatus: "complete",
				buildStatus: "complete",
				deploymentStatus: "complete"
			}
		});
	}

	static async countFailedSyncedReposForSubscription(subscription: Subscription): Promise<number> {
		return RepoSyncState.countSubscriptionRepos(subscription, {
			where: {
				[Op.or]: {
					pullStatus: "failed",
					branchStatus: "failed",
					commitStatus: "failed",
					buildStatus: "failed",
					deploymentStatus: "failed"
				}
			}
		});
	}


	static async getFailedFromSubscription(subscription: Subscription, options: FindOptions = {}): Promise<RepoSyncState[]> {

		const result = await RepoSyncState.findAll(merge(options, {
			where: {
				subscriptionId: subscription.id,
				[Op.or]: {
					pullStatus: "failed",
					branchStatus: "failed",
					commitStatus: "failed",
					buildStatus: "failed",
					deploymentStatus: "failed"
				}
			}
		}));
		return result || [];
	}

	static async createForSubscription(subscription: Subscription, values: Partial<RepoSyncState>, options: CreateOptions = {}): Promise<RepoSyncState> {
		return RepoSyncState.create(merge(values, { subscriptionId: subscription.id }), options);
	}

	private static async countSubscriptionRepos(subscription: Subscription, options: CountOptions = {}): Promise<number> {
		return RepoSyncState.count(merge(options, {
			where: {
				subscriptionId: subscription.id
			}
		}));
	}

	static async findByRepoId(subscription: Subscription, repoId: number): Promise<RepoSyncState | null> {
		return RepoSyncState.findOneFromSubscription(subscription, {
			where: {
				repoId
			}
		});
	}

	static async findAllFromSubscription(subscription: Subscription, options: FindOptions = {}): Promise<RepoSyncState[]> {
		const result = await RepoSyncState.findAll(merge(options, {
			where: {
				subscriptionId: subscription.id
			}
		}));
		return result || [];
	}

	static async findOneFromSubscription(subscription: Subscription, options: FindOptions = {}): Promise<RepoSyncState | null> {
		return RepoSyncState.findOne(merge(options, {
			where: {
				subscriptionId: subscription.id
			},
			order: [["repoUpdatedAt", "DESC"]]
		} as FindOptions));
	}

	static async updateFromSubscription(subscription: Subscription, values: Record<string, unknown>, options: Partial<UpdateOptions> = {}): Promise<[affectedCount: number]> {
		return RepoSyncState.update(values, merge(options || {}, {
			where: {
				subscriptionId: subscription.id
			}
		} as UpdateOptions));
	}

	static async updateRepoFromSubscription(subscription: Subscription, repoId: number, values: Record<string, unknown>, options: Partial<UpdateOptions> = {}): Promise<[affectedCount: number]> {
		return RepoSyncState.updateFromSubscription(subscription, values, merge(options, {
			where: {
				repoId
			}
		} as UpdateOptions));
	}

	static async deleteFromSubscription(subscription: Subscription, options: DestroyOptions = {}): Promise<number> {
		return RepoSyncState.destroy(merge(options, {
			where: {
				subscriptionId: subscription.id
			}
		}));
	}

	static async deleteRepoForSubscription(subscription: Subscription, repoId: number, options: DestroyOptions = {}): Promise<number> {
		return RepoSyncState.destroy(merge(options, {
			where: {
				subscriptionId: subscription.id,
				repoId
			}
		}));
	}

	static async findByOrgNameAndSubscriptionId(orgName: string, subscription: Subscription | null, options: FindOptions = {}):  Promise<RepoSyncState | null> {
		return await RepoSyncState.findOne(merge(options, {
			where: {
				subscriptionId: subscription?.id,
				repoOwner: orgName
			}
		} as FindOptions));
	}

	// Nullify statuses and cursors to start anew
	static async resetSyncFromSubscription(subscription: Subscription): Promise<[affectedCount: number]> {
		return RepoSyncState.update({
			repoUpdatedAt: null,
			branchStatus: null,
			branchCursor: null,
			commitStatus: null,
			commitCursor: null,
			pullStatus: null,
			pullCursor: null,
			buildStatus: null,
			buildCursor: null,
			deploymentStatus: null,
			deploymentCursor: null,
			commitFrom: null
		}, {
			where: {
				subscriptionId: subscription.id
			}
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
	commitFrom: DATE,
	branchFrom: DATE,
	pullFrom: DATE,
	buildFrom: DATE,
	deploymentFrom: DATE,
	forked: BOOLEAN,
	repoPushedAt: DATE,
	repoUpdatedAt: DATE,
	repoCreatedAt: DATE,
	syncUpdatedAt: DATE,
	syncCompletedAt: DATE,
	config: JSON,
	createdAt: DATE,
	updatedAt: DATE,
	failedCode: STRING
}, { sequelize });
