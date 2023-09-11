import "@atlaskit/css-reset";
import { withLDProvider } from "launchdarkly-react-client-sdk";
import createHashWithSharedSecret from "./services/encryptor";
import App from "./app";

// TODO: Find out how these values are being set for current app and use similar approach
const LD_CLIENT_KEY: string = process.env.REACT_APP_LAUNCHDARKLY_CLIENT_KEY || "";

// Getting the jiraHost name from the iframe URL
const getJiraHost = (): string => {
	const jiraHostFromUrl = new URLSearchParams(location.search).get("xdm_e");
	return jiraHostFromUrl ? createHashWithSharedSecret(jiraHostFromUrl.toString()) : "global";
};

const FeatureFlaggedApp = withLDProvider({
	clientSideID: LD_CLIENT_KEY,
	user: {
		key: getJiraHost()
	},
})(App);

export default FeatureFlaggedApp;
