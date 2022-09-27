import { transformRepositoryId } from "~/src/transforms/transform-repository-id";

describe("transform-repository-id", () => {
	it("does nothing for GitHub cloud", () => {
		expect(transformRepositoryId(123)).toEqual("123");
	});

	it("adds prefix for GHES ids", () => {
		expect(transformRepositoryId(123, "http://my-ghes.com/foo")).toEqual("6d7967686573636f6d666f6f-123");
	});

	it("protocol doesn't matter", () => {
		expect(transformRepositoryId(123, "http://my-ghes.com/foo"))
			.toEqual(transformRepositoryId(123, "https://my-ghes.com/foo"));
	});

	it("case doesn't matter", () => {
		expect(transformRepositoryId(123, "http://my-ghEs.com/foO"))
			.toEqual(transformRepositoryId(123, "http://my-ghes.com/foo"));
	});

	it("special chars doesn't matter", () => {
		expect(transformRepositoryId(123, "http://my-ghes.com/foo"))
			.toEqual(transformRepositoryId(123, "http://my-ghes.com/foo///"));
	});
});
