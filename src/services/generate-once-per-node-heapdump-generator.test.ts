import { getLogger } from "config/logger";
import v8 from "v8";
import { hasEnoughFreeHeap } from "utils/heap-size-utils";
import { GenerateOncePerNodeHeadumpGenerator } from "services/generate-once-per-node-headump-generator";
import fs from "fs";
import * as stream from "stream";
import { waitUntil } from "test/utils/wait-until";

jest.mock("utils/heap-size-utils");
jest.mock("v8");

describe("heapdump-generator", () => {
	let generator: GenerateOncePerNodeHeadumpGenerator;

	beforeEach(() => {
		generator = new GenerateOncePerNodeHeadumpGenerator({
			logger: getLogger("test"),
			lowHeapAvailPct: 20
		});
		const mockStream = new stream.Readable();
		mockStream.push("the heapdump");
		mockStream.push(null);
		(v8.getHeapSnapshot as jest.Mock).mockReturnValue(mockStream);
	});

	const deleteFileSafe = (path: string) => {
		try {
			fs.unlinkSync(path);
			// eslint-disable-next-line no-empty
		} catch (err: unknown) {

		}
	};

	afterEach(() => {
		deleteFileSafe("/tmp/hd_generated");
		deleteFileSafe("/tmp/dump_heap.ready");
		deleteFileSafe("/tmp/dump_heap.generating");
	});

	it("should not create heapdump when enough memory available", () => {
		(hasEnoughFreeHeap as jest.Mock).mockReturnValue(true);
		expect(generator.maybeGenerateDump()).toBeFalsy();
		expect(v8.getHeapSnapshot).not.toBeCalled();
	});

	it("should create dump when heap is too small", async () => {
		(hasEnoughFreeHeap as jest.Mock).mockReturnValue(false);
		expect(generator.maybeGenerateDump()).toBeTruthy();
		expect(v8.getHeapSnapshot).toBeCalled();
		await waitUntil(() => {
			return Promise.resolve(expect(fs.readFileSync("/tmp/dump_heap.ready").toLocaleString()).toStrictEqual("the heapdump"));
		});
	});

	it("should create only a single dump file", async () => {
		(hasEnoughFreeHeap as jest.Mock).mockReturnValue(false);
		expect(generator.maybeGenerateDump()).toBeTruthy();
		await waitUntil(() => {
			return Promise.resolve(expect(fs.readFileSync("/tmp/dump_heap.ready")).toBeTruthy());
		});
		expect(generator.maybeGenerateDump()).toBeFalsy();
		expect(v8.getHeapSnapshot).toBeCalledTimes(1);
	});
});
