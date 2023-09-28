import { setGlobalTheme } from "@atlaskit/tokens";
import {
	BrowserRouter,
	Route,
	Routes,
} from "react-router-dom";
import StartConnection from "./pages/StartConnection";
import ConfigSteps from "./pages/ConfigSteps";
import Connected from "./pages/Connected";
import InstallationRequested from "./pages/InstallationRequested";
import DeferredInstallationRequested from "./pages/DeferredInstallationRequested";
import DeferredInstallationConnected from "./pages/DeferredInstallationRequested/Connected";

import * as Sentry from "@sentry/react";
import { initSentry } from "./sentry";

initSentry();

const SentryRoutes = Sentry.withSentryReactRouterV6Routing(Routes);

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
			<SentryRoutes>
				<Route path="/spa">
					<Route index element={<StartConnection/>}/>
					<Route path="steps" element={<ConfigSteps/>}/>
					<Route path="connected" element={<Connected />}/>
					<Route path="installationRequested" element={<InstallationRequested />}/>
					<Route path="deferred" element={<DeferredInstallationRequested />}/>
					<Route path="deferred/connected" element={<DeferredInstallationConnected />}/>
				</Route>
			</SentryRoutes>
		</BrowserRouter>
	);
};

export default App;
