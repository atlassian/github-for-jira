import React from "react";
import ReactDOM from "react-dom/client";
import {
	BrowserRouter,
	Route,
	Routes,
} from "react-router-dom";
import StartConnection from "./pages/StartConnection";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
	<React.StrictMode>
		<BrowserRouter>
			<Routes>
				<Route path="/spa">
					<Route index element={<StartConnection />} />
				</Route>
			</Routes>
		</BrowserRouter>
	</React.StrictMode>
);
