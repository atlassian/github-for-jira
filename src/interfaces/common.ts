export enum EnvironmentEnum {
	test = "test",
	development = "development",
	production = "production",
}

export enum BooleanEnum {
	true = "true",
	false = "false",
}

// Adding session information to express Request type
declare global {
	// eslint-disable-next-line @typescript-eslint/no-namespace
	namespace Express {
		interface Request {
			session: {
				jiraHost?: string;
				githubToken?: string;
			};
		}
	}
}

export interface Config {
	deployments?: {

		/**
		 * globs that are used in the `mapEnvironment()` function to match a given environment with one
		 * of the valid Jira environment types.
		 */
		environmentMapping?: {
			development?: string[];
			testing?: string[];
			staging?: string[];
			production?: string[];
		}
	}
}
