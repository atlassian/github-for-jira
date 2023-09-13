//Need this line to make it a "module" file
//https://stackoverflow.com/a/42257742
export {};

declare global {
	const AP: AtlassianPlugin;
	const SPA_APP_ENV: "" | "local" | "dev" | "staging" | "prod";
	const SENTRY_SPA_DSN: string | undefined;
	const FRONTEND_FEATURE_FLAGS: any;
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

