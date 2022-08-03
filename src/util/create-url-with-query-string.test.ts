import { createUrlWithQueryString } from "./create-url-with-query-string";

describe("check-and-add-query-string", () => {
	it(`Should return URL with all the query parameters`, async () => {
		const request =  {
			query: {
				son: "goku",
				uzumaki: "naruto",
				ketchum: "ash"
			}
		} as any;
		const URL = "http://myrandomSite.com";
		const resultUrl = createUrlWithQueryString(request, URL);

		expect(resultUrl).toBe(`${URL}?son=goku&uzumaki=naruto&ketchum=ash`);
	});

	it(`Should return just URL for empty query`, async () => {
		const request =  { query: {} } as any;
		const URL = "http://myrandomSite.com";
		const resultUrl = createUrlWithQueryString(request, URL);

		expect(resultUrl).toBe(`${URL}`);
	});

	it(`Should return just URL for null query`, async () => {
		const request = {} as any;
		const URL = "http://myrandomSite.com";
		const resultUrl = createUrlWithQueryString(request, URL);

		expect(resultUrl).toBe(`${URL}`);
	});
});

