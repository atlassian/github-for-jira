import InstallationModel from "./installation";
import SubscriptionModel from "./subscription";
import RepoSyncStateModel from "./reposyncstate";
import Sequelize, { DataTypes } from "sequelize";
import EncryptedField from "sequelize-encrypted";
import { sequelize } from "./sequelize";

// TODO: need to move this into a function
if (!process.env.STORAGE_SECRET) {
	throw new Error("STORAGE_SECRET is not defined.");
}

const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

InstallationModel.init({
	jiraHost: DataTypes.STRING,
	secrets: encrypted.vault("secrets"),
	sharedSecret: encrypted.field("sharedSecret", {
		type: DataTypes.STRING,
		allowNull: false
	}),
	clientKey: {
		type: DataTypes.STRING,
		allowNull: false
	},
	enabled: Sequelize.BOOLEAN
}, { sequelize });

SubscriptionModel.init({
	id: DataTypes.INTEGER,
	gitHubInstallationId: DataTypes.INTEGER,
	jiraHost: DataTypes.STRING,
	selectedRepositories: DataTypes.ARRAY(DataTypes.INTEGER),
	repoSyncState: DataTypes.JSONB,
	syncStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	syncWarning: DataTypes.STRING,
	jiraClientKey: DataTypes.STRING
}, { sequelize });

RepoSyncStateModel.init({
	id: Sequelize.INTEGER,
	subscriptionId: Sequelize.INTEGER,
	repoId: Sequelize.INTEGER,
	repoName: Sequelize.STRING,
	repoOwner: Sequelize.STRING,
	repoFullName: Sequelize.STRING,
	repoUrl: Sequelize.STRING,
	commitCount: Sequelize.INTEGER,
	branchCount: Sequelize.INTEGER,
	issueCount: Sequelize.INTEGER,
	pullCount: Sequelize.INTEGER,
	buildCount: Sequelize.INTEGER,
	deploymentCount: Sequelize.INTEGER,
	watchCount: Sequelize.INTEGER,
	starCount: Sequelize.INTEGER,
	forkCount: Sequelize.INTEGER,
	popularity: Sequelize.INTEGER,
	status: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	branchStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	commitStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	issueStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	pullStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	buildStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	deploymentStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	branchCursor: Sequelize.STRING,
	commitCursor: Sequelize.STRING,
	issueCursor: Sequelize.STRING,
	pullCursor: Sequelize.STRING,
	buildCursor: Sequelize.STRING,
	deploymentCursor: Sequelize.STRING,
	forked: Sequelize.BOOLEAN,
	pushedAt: Sequelize.DATE,
	createdAt: Sequelize.DATE,
	updatedAt: Sequelize.DATE
}, { sequelize });

// Associations
// TODO: update sequelize to V6, use sequelize-typescript library
// SubscriptionModel.hasMany(RepoSyncStateModel, {as: "repoSyncStates"});

export const Installation = InstallationModel;
export const Subscription = SubscriptionModel;
export const RepoSyncState = RepoSyncStateModel;
