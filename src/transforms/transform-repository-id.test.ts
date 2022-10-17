import { transformRepositoryId } from "~/src/transforms/transform-repository-id";
import { GITHUB_CLOUD_BASEURL } from "utils/get-github-client-config";
import { when } from "jest-when";
import { booleanFlag, BooleanFlags } from "config/feature-flags";

jest.mock("config/feature-flags");

describe("transform-repository-id", () => {
	beforeEach(async () => {
		when(booleanFlag).calledWith(
			BooleanFlags.USE_REPO_ID_TRANSFORMER,
			expect.anything()
		).mockResolvedValue(true);
	});

	it("does nothing for GitHub cloud", async () => {
		expect(await transformRepositoryId(123)).toEqual("123");
	});

	it("does nothing for GitHub cloud when cloud URL is provided", async () => {
		expect(await transformRepositoryId(123, GITHUB_CLOUD_BASEURL)).toEqual("123");
	});

	it("adds prefix for GHES ids", async () => {
		expect(await transformRepositoryId(123, "http://my-ghes.com/foo")).toEqual("6d7967686573636f6d666f6f-123");
	});

	it("protocol doesn't matter", async () => {
		expect(await transformRepositoryId(123, "http://my-ghes.com/foo"))
			.toEqual(await transformRepositoryId(123, "https://my-ghes.com/foo"));
	});

	it("case doesn't matter", async () => {
		expect(await transformRepositoryId(123, "http://my-ghEs.com/foO"))
			.toEqual(await transformRepositoryId(123, "http://my-ghes.com/foo"));
	});

	it("special chars doesn't matter", async () => {
		expect(await transformRepositoryId(123, "http://my-ghes.com/foo"))
			.toEqual(await transformRepositoryId(123, "http://my-ghes.com/foo/_+//"));
	});

	it("path matters", async () => {
		expect(await transformRepositoryId(123, "http://my-ghes.com/foo"))
			.not.toEqual(await transformRepositoryId(123, "http://my-ghes.com/bar"));
	});

	it("port matters", async () => {
		expect(await transformRepositoryId(123, "http://my-ghes.com/foo"))
			.not.toEqual(await transformRepositoryId(123, "http://my-ghes.com:1234/foo"));
	});
});
