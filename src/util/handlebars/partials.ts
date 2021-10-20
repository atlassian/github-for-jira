import hbs from "hbs";
import * as fs from "fs";

export const registerHandlebarsPartials = (rootPath: string) => {
	const partials = ["githubSetupForm", "githubSetupFormError"];

	partials.forEach((partial) => {
		hbs.registerPartial(
			partial,
			fs.readFileSync(`${rootPath}/views/partials/${partial}.hbs`, {
				encoding: "utf8",
			})
		);
	});
};
