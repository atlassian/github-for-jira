const USER_CONFIG_FILE = ".jira/config.yml";

export const updateRepoConfig = async (modifiedFiles: string[] = []): Promise<void> => {
	// Only get save the latest repo config if the file in the repository changed (added, modified or removed)
	if (modifiedFiles.includes(USER_CONFIG_FILE)) {
		await saveRepoConfig();
	}
};

const saveRepoConfig = async (): Promise<void> => {

};
