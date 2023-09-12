import "@atlaskit/css-reset";
import { withLDProvider } from "launchdarkly-react-client-sdk";
import App from "./app";

/**
 * NOTE: FF doesn't work in local environment
 * Cause LD_CLIENT_KEY AND HASHED_JIRAHOST are defined from the node app,
 * doesn't work for local/dev environment
 */
const FeatureFlaggedApp = withLDProvider({
	clientSideID: LD_CLIENT_KEY,
	user: {
		key: HASHED_JIRAHOST
	},
})(App);

export default FeatureFlaggedApp;
