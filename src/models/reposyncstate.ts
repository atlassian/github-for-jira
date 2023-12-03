import {
	BOOLEAN,
	CountOptions,
	CreateOptions,
	DataTypes,
	DATE,
	DestroyOptions,
	FindOptions,
	INTEGER,
	Model,
	Op,
	STRING,
	UpdateOptions,
	JSON,
	QueryTypes, Order
} from "sequelize";
import { Subscription, TaskStatus } from "./subscription";
import { merge } from "lodash";
import { sequelize } from "models/sequelize";
import { Config } from "interfaces/common";

export interface RepoSyncStateProperties {
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
	dependabotAlertStatus?: TaskStatus;
	secretScanningAlertStatus?: TaskStatus,
	codeScanningAlertStatus?: TaskStatus,
	branchCursor?: string;
	commitCursor?: string;
	issueCursor?: string;
	pullCursor?: string;
	buildCursor?: string;
	deploymentCursor?: string;
	dependabotAlertCursor?: string;
	secretScanningAlertCursor?: string;
	codeScanningAlertCursor?: string;
	commitFrom?: Date;
	branchFrom?: Date;
	pullFrom?: Date;
	buildFrom?: Date;
	deploymentFrom?: Date;
	dependabotAlertFrom?: Date;
	secretScanningAlertFrom?: Date;
	codeScanningAlertFrom?: Date;
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

export class RepoSyncState extends Model implements RepoSyncStateProperties {
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
	dependabotAlertStatus?: TaskStatus;
	secretScanningAlertStatus?: TaskStatus;
	codeScanningAlertStatus?: TaskStatus;
	branchCursor?: string;
	commitCursor?: string;
	issueCursor?: string;
	pullCursor?: string;
	buildCursor?: string;
	deploymentCursor?: string;
	dependabotAlertCursor?: string;
	secretScanningAlertCursor?: string;
	codeScanningAlertCursor?: string;
	commitFrom?: Date;
	branchFrom?: Date;
	pullFrom?: Date;
	buildFrom?: Date;
	deploymentFrom?: Date;
	dependabotAlertFrom?: Date;
	secretScanningAlertFrom?: Date;
	codeScanningAlertFrom?: Date;
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
					deploymentStatus: "failed",
					dependabotAlertStatus: "failed",
					secretScanningAlertStatus: "failed",
					codeScanningAlertStatus: "failed"
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
					deploymentStatus: "failed",
					dependabotAlertStatus: "failed",
					secretScanningAlertStatus: "failed",
					codeScanningAlertStatus: "failed"
				}
			}
		}));
		return result || [];
	}

	static async createForSubscription(subscription: Subscription, values: Partial<RepoSyncState>, options: CreateOptions = {}): Promise<RepoSyncState> {
		return RepoSyncState.create(merge(values, { subscriptionId: subscription.id }), options);
	}

	static async countSubscriptionRepos(subscription: Subscription, options: CountOptions = {}): Promise<number> {
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

	static async findRepoByRepoIdAndJiraHost(repoId: number, jiraHost: string): Promise<RepoSyncState & Subscription | null> {
		// sequelize is always set in this class but is optional in the base class
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const results = await this.sequelize!.query(
			"SELECT * " +
			"FROM \"Subscriptions\" s " +
			"LEFT JOIN \"RepoSyncStates\" rss on s.\"id\" = rss.\"subscriptionId\" " +
			"WHERE s.\"jiraHost\" = :jiraHost " +
			"AND rss.\"repoId\" = :repoId ",
			{
				replacements: { jiraHost, repoId },
				type: QueryTypes.SELECT
			}
		);

		if (results.length === 0) {
			return null;
		}

		return results[0] as RepoSyncState & Subscription;
	}

	static async findAllFromSubscription(subscription: Subscription, limit: number, offset: number, order: Order, options: FindOptions = {}): Promise<RepoSyncState[]> {
		const result = await RepoSyncState.findAll(merge(options, {
			where: {
				subscriptionId: subscription.id
			},
			limit,
			offset,
			order
		}));
		return result || [];
	}

	// TODO: move repoOwner to Subscription table and get rid of this.
	// The current schema implies a subscription might have multiple
	// "repoOwner"s associated with it, while that's impossible
	static async findAllRepoOwners(subscription: Subscription): Promise<Set<string>> {
		const owners = await RepoSyncState.findAll({
			attributes: ["repoOwner"],
			where: {
				subscriptionId: subscription.id
			},
			group: "repoOwner"
		});
		return new Set(owners.map((owner) => owner.getDataValue("repoOwner")));
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

	static async findByOrgNameAndSubscriptionId(subscription: Subscription, orgName: string): Promise<RepoSyncState | null> {
		return await RepoSyncState.findOne({
			where: {
				subscriptionId: subscription.id,
				repoOwner: {
					[Op.iLike]: `%${orgName}%`
				}
			}
		});
	}

	static async findRepositoriesBySubscriptionIdsAndRepoName(
		jiraHost: string,
		subscriptionIds: number | number[],
		page: number,
		limit: number,
		repoName?: string
	): Promise<RepoSyncState[] | null> {
		const subscriptionIdsArray = Array.isArray(subscriptionIds) ? subscriptionIds : [subscriptionIds];
		const offset = (page - 1) * limit;
		const replacements = {
			jiraHost,
			subscriptionIds: subscriptionIdsArray,
			repoName,
			offset,
			limit
		};

		const query = `
			SELECT DISTINCT ON (rss."id") rss.*
			FROM "Subscriptions" s
			LEFT JOIN "RepoSyncStates" rss ON s."id" = rss."subscriptionId"
			WHERE s."jiraHost" = :jiraHost
				AND s."id" IN (:subscriptionIds)
				${replacements.repoName ? "AND rss.\"repoName\" ILIKE :repoName" : ""}
			ORDER BY rss."id", rss."updatedAt" DESC
			OFFSET :offset
			LIMIT :limit
		`;

		// sequelize is always set in this class but is optional in the base class
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const repositories = await this.sequelize!.query(query, {
			replacements: {
				jiraHost,
				subscriptionIds: subscriptionIdsArray,
				repoName: replacements.repoName ? `%${replacements.repoName}%` : undefined,
				offset,
				limit
			},
			type: QueryTypes.SELECT
		});

		return repositories as RepoSyncState[];
	}

	static async findOneForRepoUrlAndRepoIdAndJiraHost(repoUrl: string, repoId: number, jiraHost: string):Promise<RepoSyncState | null> {
		// sequelize is always set in this class but is optional in the base class
		// eslint-disable-next-line @typescript-eslint/no-non-null-assertion
		const results = await this.sequelize!.query(
			`SELECT rss.*
			FROM "RepoSyncStates" rss
			JOIN "Subscriptions" s ON rss."subscriptionId" = s."id"
			WHERE REPLACE(rss."repoUrl", '.', '') LIKE :repoUrl
			AND rss."repoId" = :repoId
			AND s."jiraHost" = :jiraHost
			`,
			{
				replacements: {
					repoUrl: `%${repoUrl.replace(/\./g, "")}%`,
					repoId,
					jiraHost
				},
				type: QueryTypes.SELECT
			}
		);

		if (results.length === 0) {
			return null;
		}

		return results[0] as RepoSyncState;
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
			commitFrom: null,
			dependabotAlertStatus: null,
			dependabotAlertCursor: null,
			dependabotAlertFrom: null,
			secretScanningAlertFrom: null,
			secretScanningAlertStatus: null,
			secretScanningAlertCursor: null,
			codeScanningAlertFrom: null,
			codeScanningAlertStatus: null,
			codeScanningAlertCursor: null
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
	dependabotAlertStatus: DataTypes.ENUM("pending", "complete", "failed"),
	secretScanningAlertStatus: DataTypes.ENUM("pending", "complete", "failed"),
	codeScanningAlertStatus: DataTypes.ENUM("pending", "complete", "failed"),
	branchCursor: STRING,
	commitCursor: STRING,
	issueCursor: STRING,
	pullCursor: STRING,
	buildCursor: STRING,
	deploymentCursor: STRING,
	dependabotAlertCursor: STRING,
	secretScanningAlertCursor: STRING,
	codeScanningAlertCursor: STRING,
	commitFrom: DATE,
	branchFrom: DATE,
	pullFrom: DATE,
	buildFrom: DATE,
	deploymentFrom: DATE,
	dependabotAlertFrom: DATE,
	secretScanningAlertFrom: DATE,
	codeScanningAlertFrom: DATE,
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
