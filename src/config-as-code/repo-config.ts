import minimatch from "minimatch";

export interface RepoConfig {
	deployments: {

		/**
		 * Regular expressions that are used in the `mapEnvironment()` function to match a given environment with one
		 * of the valid Jira environment types.
		 */
		environmentMapping: {
			development?: string[];
			testing?: string[];
			staging?: string[];
			production?: string[];
		}
	}
}

const matchesEnvironment = (globPatterns: string[], environment: string): boolean => {
	for (const glob of globPatterns) {
		if (minimatch(environment, glob)) {
			return true;
		}
	}
	return false;
}

/**
 * Maps a given environment name to a Jira environment name using the custom mapping defined in a RepoConfig.
 */
export const mapEnvironmentWithRepoConfig = (environment: string, repoConfig: RepoConfig): string => {
	const jiraEnvironment = Object.keys(repoConfig.deployments.environmentMapping)
		.find(jiraEnvironmentType => matchesEnvironment(repoConfig.deployments.environmentMapping[jiraEnvironmentType], environment));

	if (!jiraEnvironment) {
		return "unmapped";
	}

	return jiraEnvironment;
}
