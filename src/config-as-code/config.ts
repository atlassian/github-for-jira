export type Config = {
	deployments: {
		environmentMapping: {
			development: string[];
			testing: string[];
			staging: string[];
			production: string[];
		}
	}
}
