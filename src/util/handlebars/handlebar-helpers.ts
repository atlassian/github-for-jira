import hbs from "hbs";
import { isPlainObject } from "lodash";
import { ConnectionSyncStatus } from "~/spa/src/rest-interfaces";

export const concatStringHelper = (...strings: string[]) => strings.filter((arg: unknown) => typeof arg !== "object").join(" ");
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
export const toLowercaseHelper = (str?: string) => !isPlainObject(str) && str?.toString?.().toLowerCase() || "";
// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
export const replaceSpaceWithHyphenHelper = (str?: string) => !isPlainObject(str) && str?.toString?.().replace(/ /g, "-") || "";
export const toISOStringHelper = (date?: Date) => date ? date.toISOString() : undefined;

type Connection = { syncStatus?: ConnectionSyncStatus, syncWarning?: string };
export const isAllSyncSuccess = (conn?: Connection) => {
	return conn && conn.syncStatus === "FINISHED" && !conn.syncWarning ? true : false;
};

export const registerHandlebarsHelpers = () => {
	hbs.registerHelper("toLowerCase", toLowercaseHelper);

	hbs.registerHelper("replaceSpaceWithHyphen", replaceSpaceWithHyphenHelper);
	hbs.registerHelper("concat", concatStringHelper);
	hbs.registerHelper("toISOString", toISOStringHelper);

	hbs.registerHelper(
		"ifAllReposSynced",
		(numberOfSyncedRepos: number, totalNumberOfRepos: number): string =>
			numberOfSyncedRepos === totalNumberOfRepos
				? String(totalNumberOfRepos)
				: `${numberOfSyncedRepos} / ${totalNumberOfRepos}`
	);

	hbs.registerHelper("checkRepoCount", (totalNumberOfRepos: unknown) => (typeof totalNumberOfRepos === "number" &&  totalNumberOfRepos >= 0));

	hbs.registerHelper("repoAccessType", (repository_selection: string) =>
		repository_selection === "all" ? "All repos" : "Only select repos"
	);

	hbs.registerHelper("isNotConnected", (syncStatus) => syncStatus == null);

	hbs.registerHelper("setSubscriptionUrl", (uuid: string, installationId: number) => uuid
		? `/github/${uuid}/subscriptions/${installationId}`
		: `/github/subscriptions/${installationId}`
	);

	hbs.registerHelper("isAllSyncSuccess", isAllSyncSuccess);
	hbs.registerHelper(
		"inProgressOrPendingSync",
		(syncStatus) => syncStatus === "IN PROGRESS" || syncStatus === "PENDING"
	);

	hbs.registerHelper("failedSync", (syncStatus) => syncStatus === "FAILED");

	hbs.registerHelper("failedConnectionErrorMsg", (deleted) =>
		deleted
			? "The GitHub for Jira app was uninstalled from this org."
			: "There was an error getting information for this installation."
	);

	// TODO - remove after removing old github config hbs
	hbs.registerHelper("connectedStatus", (syncStatus) =>
		syncStatus === "FINISHED" ? "Connected" : "Connect"
	);

	hbs.registerHelper("isModal", (modalId) => modalId === "jiraDomainModal");


	hbs.registerHelper("isMissingPermissions", (syncWarning?: string) => syncWarning?.includes("Invalid permissions for"));

	hbs.registerHelper(
		"disableDeleteSubscription",
		(subscriptionHost, jiraHost) =>
			subscriptionHost !== jiraHost
	);

	// Greater than
	hbs.registerHelper("gt", (a: string, b: string) => a > b);

	hbs.registerHelper("json", (context) =>
		JSON.stringify(context)
	);

};
