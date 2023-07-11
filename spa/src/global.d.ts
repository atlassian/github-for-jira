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
	authenticateInGitHub: () => Promise<void>;
	setTokens: (...args: any) => void;
	getUserDetails: () => { username: string, email: string };
}
