export type RepoConfig = {
	deployments: {
		environmentMapping: {
			development: string[];
			testing: string[];
			staging: string[];
			production: string[];
		}
	}
}
