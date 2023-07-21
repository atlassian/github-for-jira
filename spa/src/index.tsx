import React from "react";
import ReactDOM from "react-dom/client";
import "@atlaskit/css-reset";
import { setGlobalTheme } from "@atlaskit/tokens";
import {
	BrowserRouter,
	Route,
	Routes,
} from "react-router-dom";
import StartConnection from "./pages/StartConnection";
import ConfigSteps from "./pages/ConfigSteps";
import Connected from "./pages/Connected";

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
					<Route path="connected" element={<Connected />}/>
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
