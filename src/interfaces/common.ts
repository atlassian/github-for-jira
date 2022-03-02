export enum EnvironmentEnum {
	test = "test",
	development = "development",
	production = "production",
}

export enum BooleanEnum {
	true = "true",
	false = "false",
}

// All variables below were defined by DataPortal. Do not change their values as it will affect our metrics logs and dashboards.
export enum AnalyticsEventTypesEnum {
	ScreenEvent = "screen",
	UiEvent = "ui",
	TrackEvent = "track",
	OperationalEvent = "operational",
	TraitEvent = "trait",

}

// All variables below were defined by DataPortal. Do not change their values as it will affect our metrics logs and dashboards.
export enum AnalyticsScreenEventsEnum {
	GitHubConfigScreenEventName = "githubConfigurationScreen"
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
