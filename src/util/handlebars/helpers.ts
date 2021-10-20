import hbs from "hbs";

export const registerHandlebarsHelpers = () => {
	hbs.registerHelper("toLowerCase", (str) => str.toLowerCase());

	hbs.registerHelper("replaceSpaceWithHyphen", (str) => str.replace(/ /g, "-"));

	hbs.registerHelper(
		"ifAllReposSynced",
		(numberOfSyncedRepos, totalNumberOfRepos) =>
			numberOfSyncedRepos === totalNumberOfRepos
				? totalNumberOfRepos
				: `${numberOfSyncedRepos} / ${totalNumberOfRepos}`
	);

	hbs.registerHelper("repoAccessType", (repository_selection) =>
		repository_selection === "all" ? "All repos" : "Only select repos"
	);

	hbs.registerHelper("isNotConnected", (syncStatus) => syncStatus == null);

	hbs.registerHelper(
		"inProgressSync",
		(syncStatus) => syncStatus === "IN PROGRESS"
	);

	hbs.registerHelper("failedSync", (syncStatus) => syncStatus === "FAILED");

	hbs.registerHelper("failedConnectionErrorMsg", (deleted) =>
		deleted
			? "The GitHub for Jira app was uninstalled from this org."
			: "There was an error getting information for this installation."
	);

	hbs.registerHelper("connectedStatus", (syncStatus) =>
		syncStatus === "COMPLETE" ? "Connected" : "Connect"
	);

	hbs.registerHelper("isModal", (modalId) => modalId === "jiraDomainModal");
};
