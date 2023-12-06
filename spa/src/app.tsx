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
import DeferredInstallation from "./pages/DeferredInstallation";
import Connections from "./pages/Connections";
import ForbiddenState from "./pages/DeferredInstallation/ForbiddenState";
import ConnectState from "./pages/DeferredInstallation/ConnectState";
import ErrorState from "./pages/DeferredInstallation/ErrorState";
import Repositories from "./pages/Repositories";

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
					<Route path="connections" element={<Connections />}/>
					<Route path="steps" element={<ConfigSteps/>}/>
					<Route path="connected" element={<Connected />}/>
					<Route path="installationRequested" element={<InstallationRequested />}/>
					<Route path="deferred">
						<Route index element={<DeferredInstallation />} />
						<Route path="connect" element={<ConnectState />} />
						<Route path="forbidden" element={<ForbiddenState />} />
						<Route path="error" element={<ErrorState />} />
					</Route>
					<Route path="deferred" element={<DeferredInstallation />}/>
					<Route path="repositories" element={<Repositories />}/>
				</Route>
			</SentryRoutes>
		</BrowserRouter>
	);
};

export default App;
