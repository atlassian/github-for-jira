declare const AP: AtlassianPlugin;

interface AtlassianPlugin {
	getLocation: (...args) => void;
	navigator: {
		go: (...args) => void;
		reload: () => void;
	},
	context: {
		getToken: ((token: string) => void);
	}
}
