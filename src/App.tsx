import React from "react";
import { Route, Link } from "react-router-dom";
import { TestPage } from "./client/ui/Test";

export const App = (): JSX.Element => {
	return (
		<div>
			<h1>Hi, from React!</h1>
			<Link to="/test">Test</Link>

			<div>
				<Route path='/test' component={TestPage} />
			</div>
		</div>
	)
}
