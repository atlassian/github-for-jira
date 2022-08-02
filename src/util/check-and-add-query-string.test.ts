import { checkAndAddQueryString } from "./check-and-add-query-string";

describe("check-and-add-query-string", () => {
	let request;
	const URL = "https://mysite.com";

	beforeEach(async () => {
		request = {
			query: {
				son: "goku",
				uzumaki: "naruto",
				ketchum: "ash",
				one: 1,
				three: 3
			}
		};
	});

	it("Check and add all the query string which are available as the query parameter in the Request", async () => {

		const urlWithQS = checkAndAddQueryString(request, URL,["son", "uzumaki", "ketchum"]);

		expect(decodeURIComponent(urlWithQS)).toBe("https://mysite.com?son=goku&uzumaki=naruto&ketchum=ash");
	});

	it("Check and only add those query string which are available as the query parameter in the Request", async () => {
		const urlWithQS = checkAndAddQueryString(request, URL, ["one", "two", "three"]);

		expect(decodeURIComponent(urlWithQS)).toBe("https://mysite.com?one=1&three=3");
	});
});

