import { OrganizationsResponse } from "./rest-interfaces/oauth-types.ts";

declare global {
	const AP: AtlassianPlugin;
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

