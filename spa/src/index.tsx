import React from "react";
import ReactDOM from "react-dom/client";
import "@atlaskit/css-reset";
import App from "./app";
import { withLDProvider } from "launchdarkly-react-client-sdk";

// TODO: Find out how these values are being set for current app and use similar approach
const LD_SDK_KEY_DEV = "XXXX";

// Getting the jiraHost name from the iframe URL
const getJiraHost = (): string => {
	const jiraHostFromUrl = new URLSearchParams(location.search).get("xdm_e");
	// TODO: figure out how to hash the jiraHost
	return jiraHostFromUrl ? jiraHostFromUrl.toString() : "global";
};


const LDProvider = withLDProvider({
	clientSideID: LD_SDK_KEY_DEV,
	user: {
		key: getJiraHost()
	},
})(App);



ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<LDProvider />
	</React.StrictMode>
);
