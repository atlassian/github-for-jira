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
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
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
	enabled: Sequelize.BOOLEAN,
	createdAt: Sequelize.DATE,
	updatedAt: Sequelize.DATE
}, { sequelize });

SubscriptionModel.init({
	id: {
		type: DataTypes.INTEGER,
		primaryKey: true,
		allowNull: false,
		autoIncrement: true
	},
	gitHubInstallationId: DataTypes.INTEGER,
	jiraHost: DataTypes.STRING,
	selectedRepositories: DataTypes.ARRAY(DataTypes.INTEGER),
	repoSyncState: DataTypes.JSONB,
	syncStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
	syncWarning: DataTypes.STRING,
	jiraClientKey: DataTypes.STRING,
	createdAt: Sequelize.DATE,
	updatedAt: Sequelize.DATE
}, { sequelize });

RepoSyncStateModel.init({
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
		type: Sequelize.INTEGER,
		allowNull: false
	},
	repoName: {
		type: Sequelize.STRING,
		allowNull: false
	},
	repoOwner: {
		type: Sequelize.STRING,
		allowNull: false
	},
	repoFullName: {
		type: Sequelize.STRING,
		allowNull: false
	},
	repoUrl: {
		type: Sequelize.STRING,
		allowNull: false
	},
	priority: Sequelize.INTEGER,
	branchStatus: DataTypes.ENUM("pending", "complete", "failed"),
	commitStatus: DataTypes.ENUM("pending", "complete", "failed"),
	issueStatus: DataTypes.ENUM("pending", "complete", "failed"),
	pullStatus: DataTypes.ENUM("pending", "complete", "failed"),
	buildStatus: DataTypes.ENUM("pending", "complete", "failed"),
	deploymentStatus: DataTypes.ENUM("pending", "complete", "failed"),
	branchCursor: Sequelize.STRING,
	commitCursor: Sequelize.STRING,
	issueCursor: Sequelize.STRING,
	pullCursor: Sequelize.STRING,
	buildCursor: Sequelize.STRING,
	deploymentCursor: Sequelize.STRING,
	forked: Sequelize.BOOLEAN,
	repoPushedAt: Sequelize.DATE,
	repoUpdatedAt: Sequelize.DATE,
	repoCreatedAt: Sequelize.DATE,
	syncUpdatedAt: Sequelize.DATE,
	syncCompletedAt: Sequelize.DATE,
	createdAt: Sequelize.DATE,
	updatedAt: Sequelize.DATE
}, { sequelize });

export const Installation = InstallationModel;
export const Subscription = SubscriptionModel;
export const RepoSyncState = RepoSyncStateModel;
