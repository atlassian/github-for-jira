declare const AP: AtlassianPlugin;

interface AtlassianPlugin {
	navigator: {
		getLocation: () => void;
		go: (...args) => void;
		reload: () => void;
	}
}
