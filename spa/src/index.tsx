import React from "react";
import ReactDOM from "react-dom/client";
import {
	BrowserRouter,
	Route,
	Routes,
} from "react-router-dom";
import StartConnection from "./pages/StartConnection";
import "@atlaskit/css-reset";
import ConfigSteps from "./pages/ConfigSteps";
import { setGlobalTheme } from "@atlaskit/tokens";
import OauthManager from "./oauth-manager";

/**
 * This is the global variable for handling Auth related methods
 */
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore
globalThis.OAuthManagerInstance = OauthManager();

const App = () => {
	setGlobalTheme({
		light: "light",
		dark: "dark",
		colorMode: "auto",
		spacing: "spacing",
		typography: "typography",
	});


	return (
		<BrowserRouter>
			<Routes>
				<Route path="/spa">
					<Route index element={<StartConnection/>}/>
					<Route path="steps" element={<ConfigSteps/>}/>
				</Route>
			</Routes>
		</BrowserRouter>
	);
};

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<App />
	</React.StrictMode>
);
