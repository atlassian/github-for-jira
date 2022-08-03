import { createUrlWithQueryString } from "./create-url-with-query-string";

describe("check-and-add-query-string", () => {
	const request =  {
		query: {
			son: "goku",
			uzumaki: "naruto",
			ketchum: "ash"
		}
	} as any;
	const URL = "http://myrandomSite.com";

	it(`Should return URL with all the query parameters`, async () => {
		const resultUrl = createUrlWithQueryString(request, URL);

		expect(decodeURIComponent(resultUrl)).toBe(`${URL}?son=goku&uzumaki=naruto&ketchum=ash`);
	});
});

