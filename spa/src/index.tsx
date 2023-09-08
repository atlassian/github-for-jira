import React from "react";
import ReactDOM from "react-dom/client";
import "@atlaskit/css-reset";
import FeatureFlaggedApp from "./feature-flagged-app";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<FeatureFlaggedApp />
	</React.StrictMode>
);
