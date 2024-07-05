import hbs from "hbs";
import * as fs from "fs";
import * as path from "path";

export const registerHandlebarsPartials = (partialPath: string) => {
	fs.readdirSync(partialPath)
		.filter(file => file.endsWith(".hbs"))
		.forEach(file => {
			hbs.registerPartial(
				file.replace(/\.hbs$/, ""), // removes extension of file
				fs.readFileSync(path.resolve(partialPath, file), {
					encoding: "utf8"
				})
			);
		});
};
