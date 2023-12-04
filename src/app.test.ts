import { getFrontendApp } from "~/src/app";
import { Axios } from "axios";

const sanitizeRegexStr = (regexStr: string) => regexStr.split("\\").join("");
describe("app", () => {
	describe("getFrontendApp", () => {
		it("please review routes and update snapshot when adding or modifying the routes!", async () => {
			const app = getFrontendApp();

			const appRoutes: Array<{method: string, path: string, exec: string[]}> = [];
			const collectRoutes = (stack, parentPath = "", parentMiddlewares: Array<any> = []) => {
				const ROOT_REGEX = parentPath + sanitizeRegexStr("^\\/?(?=\\/|$)");
				const pathMiddlewares = {};
				pathMiddlewares[ROOT_REGEX] = [...parentMiddlewares];

				stack.forEach(layer => {
					const newPath = parentPath + sanitizeRegexStr(layer.regexp.source);
					if (!pathMiddlewares[newPath]) {
						pathMiddlewares[newPath] = [...pathMiddlewares[ROOT_REGEX]];
					}

					if (layer.handle.stack) {
						collectRoutes(layer.handle.stack, newPath, pathMiddlewares[newPath]);
					} else if (layer.name === "serveStatic") {
						appRoutes.push({
							method: "*",
							path: newPath,
							exec: [
								...pathMiddlewares[newPath],
								layer.name
							]
						});
					} else if (layer.route) {
						Object.keys(layer.route.methods).forEach(method => {
							if (method != "_all") {
								appRoutes.push({
									method,
									path: newPath,
									exec: [
										...pathMiddlewares[newPath],
										... layer.route.stack.filter(subLayer => subLayer.method === undefined || subLayer.method === method).map(subLayer => subLayer.name)
									]
								});
							}
						});
					} else {
						pathMiddlewares[newPath].push(layer.name);
					}
				});
			};

			collectRoutes(app._router.stack);

			const allRoutes = appRoutes.map(route =>
				`:${route.method.toUpperCase()} ${route.path}\n\t${route.exec.join(",")}`
			).join("\n");

			expect(allRoutes).toMatchSnapshot();
		});
	});
	describe("test utils for app", () => {
		describe("nocking scope", () => {

			const axios = new Axios({ baseURL: "https://api.github.com" });
			const getToken = async () => {
				const result = await axios.post("/app/installations/123/access_tokens", undefined, { headers: { "authorization": "Bearer token" } });
				return JSON.parse(result.data).token;
			};
			const callTestApi = async () => {
				const result = await axios.get("/test");
				return result.data;
			};

			it("should only persist on access token but not the following api nock even using same nock scope", async () => {

				githubUserTokenNock(123, "ret_token").persist(); //This should be a persist nock
				githubNock.get("/test").reply(200, "hello"); //This should only mock once

				//since it is a persist nock, it should success twice
				expect(await getToken()).toEqual("ret_token");
				expect(await getToken()).toEqual("ret_token");

				expect(await callTestApi()).toEqual("hello");
				//The second time should throw as the nock only nock once
				await expect(async () => await callTestApi()).rejects.toThrowError(/No match for request/);
			});
		});
	});
});
