//Need this line to make it a "module" file
//https://stackoverflow.com/a/42257742
import { EnvironmentType } from "@atlassiansox/feature-flag-web-client/src/api/types.ts";

export {};

declare global {
	const AP: AtlassianPlugin;
	const SPA_APP_ENV: EnvironmentType;
	const SENTRY_SPA_DSN: string | undefined;
	const ATLASSIAN_ACCOUNT_ID: string;
	const HASHED_JIRAHOST: string;
}

interface AtlassianPlugin {
	getLocation: (...args) => void;
	context: {
		getToken: (...args) => void;
	}
	navigator: {
		go: (...args) => void;
		reload: () => void;
	}
}

