import { GenerateOnceCoredumpGenerator } from "services/generate-once-coredump-generator";
import { getLogger } from "config/logger";
import fs from "fs";
import dumpme from "dumpme";
import { hasEnoughFreeHeap } from "utils/heap-size-utils";

jest.mock("utils/heap-size-utils");
jest.mock("fs");
jest.mock("dumpme");

describe("coredump-generator", () => {
	let generator: GenerateOnceCoredumpGenerator;

	beforeEach(() => {
		generator = new GenerateOnceCoredumpGenerator({
			logger: getLogger("test"),
			lowHeapAvailPct: 20
		});
	});

	it("should not create coredump when enough memory available", () => {
		(hasEnoughFreeHeap as jest.Mock).mockReturnValue(true);
		expect(generator.maybeGenerateDump()).toBeFalsy();
		expect(dumpme).not.toBeCalled();
		expect(fs.renameSync).not.toBeCalled();
	});

	it("should create coredump when heap is too small", () => {
		(hasEnoughFreeHeap as jest.Mock).mockReturnValue(false);
		expect(generator.maybeGenerateDump()).toBeTruthy();
		expect(dumpme).toBeCalled();
		expect(fs.renameSync).toBeCalledWith(`/tmp/dump_core.${process.pid.toString()}`, `/tmp/dump_core.${process.pid.toString()}.ready`);
	});

	it("should create only a single coredump file", () => {
		(hasEnoughFreeHeap as jest.Mock).mockReturnValue(false);
		expect(generator.maybeGenerateDump()).toBeTruthy();
		expect(generator.maybeGenerateDump()).toBeFalsy();
		expect(dumpme).toBeCalledTimes(1);
	});
});
