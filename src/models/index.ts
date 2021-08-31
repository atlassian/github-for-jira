import InstallationModel from "./installation";
import SubscriptionModel from "./subscription";
import Sequelize, { DataTypes } from "sequelize";
import EncryptedField from "sequelize-encrypted";
import { sequelize } from "./sequelize";

// TODO: need to move this into a function
if (!process.env.STORAGE_SECRET) {
	throw new Error("STORAGE_SECRET is not defined.");
}

const encrypted = EncryptedField(Sequelize, process.env.STORAGE_SECRET);

InstallationModel?.init(
	{
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
	},
	{ sequelize }
);

SubscriptionModel?.init(
	{
		gitHubInstallationId: DataTypes.INTEGER,
		jiraHost: DataTypes.STRING,
		selectedRepositories: DataTypes.ARRAY(DataTypes.INTEGER),
		repoSyncState: DataTypes.JSONB,
		syncStatus: DataTypes.ENUM("PENDING", "COMPLETE", "ACTIVE", "FAILED"),
		syncWarning: DataTypes.STRING,
		jiraClientKey: DataTypes.STRING
	},
	{ sequelize }
);

export const Installation = InstallationModel;
export const Subscription = SubscriptionModel;
