import { OrganizationsResponse } from "./rest-interfaces/oauth-types.ts";

declare global {
	let OAuthManagerInstance: OAuthManagerType;
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

export interface OAuthManagerType {
	checkValidity: () => Promise<boolean | undefined>;
	fetchOrgs: () => Promise<OrganizationsResponse>;
	connectOrg: (orgId: number) => Promise<boolean>;
	authenticateInGitHub: () => Promise<void>;
	finishOAuthFlow: (code: string, state: string) => Promise<boolean>;
	getUserDetails: () => { username: string | undefined, email: string | undefined };
	clear: () => void;
}
