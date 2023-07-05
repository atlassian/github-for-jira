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

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/spa">
					<Route index element={<StartConnection />} />
					<Route path="steps" element={<ConfigSteps />} />
				</Route>
			</Routes>
		</BrowserRouter>
	</React.StrictMode>
);
