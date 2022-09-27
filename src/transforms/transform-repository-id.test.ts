import { transformRepositoryId } from "~/src/transforms/transform-repository-id";

describe("transform-repository-id", () => {
	it("does nothing for GitHub cloud", () => {
		expect(transformRepositoryId(123)).toEqual("123");
	});

	it("adds prefix for GHES ids", () => {
		expect(transformRepositoryId(123, "http://my-ghes.com/foo")).toEqual("687474703a2f2f6d792d676865732e636f6d2f666f6f-123");
	});
});
