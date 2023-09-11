import "@atlaskit/css-reset";
import { withLDProvider } from "launchdarkly-react-client-sdk";
import createHashWithSharedSecret from "./services/encryptor";
import App from "./app";
import envVars from "./envVars";

const LD_CLIENT_KEY: string = envVars.LAUNCHDARKLY_CLIENT_KEY;

// Getting the jiraHost name from the iframe URL
const getJiraHost = (): string => {
	const jiraHostFromUrl = new URLSearchParams(location.search).get("xdm_e");
	return jiraHostFromUrl ? createHashWithSharedSecret(jiraHostFromUrl.toString()) : "global";
};

// TODO: Remove this console later
console.log("Checking keys: ", LD_CLIENT_KEY, getJiraHost());

const FeatureFlaggedApp = withLDProvider({
	clientSideID: LD_CLIENT_KEY,
	user: {
		key: getJiraHost()
	},
})(App);

export default FeatureFlaggedApp;
