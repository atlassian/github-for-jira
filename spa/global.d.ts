declare const AP: AtlassianPlugin;

interface AtlassianPlugin {
	navigator: {
		getLocation: () => void;
		go: () => void;
		reload: () => void;
	}
}
