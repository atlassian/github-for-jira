import React from "react";
import { Route } from "react-router-dom";
import { TestPage } from "./client/ui/Test";

export const App = (): JSX.Element => {
	return (
		<div>
			<h1>Hi, from React!</h1>

			<div>
				<Route path='/test' component={TestPage} />
			</div>
		</div>
	)
}
