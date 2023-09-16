import { CoredumpGenerator } from "services/coredump-generator";
import { getLogger } from "config/logger";
import v8 from "v8";
import fs from "fs";
import dumpme from "dumpme";

jest.mock("v8");
jest.mock("fs");
jest.mock("dumpme");

describe("coredump-generator", () => {
	let generator: CoredumpGenerator;

	beforeEach(() => {
		generator = new CoredumpGenerator({
			logger: getLogger("test"),
			memLeftPctThesholdBeforeGc: 20,
			memLeftPctThesholdAfterGc: 25
		});
		(v8.getHeapStatistics as jest.Mock).mockReturnValue({
			heap_size_limit: 100,
			total_available_size: 90
		});
	});

	it("should not create coredump when enough memory available", () => {
		(v8.getHeapStatistics as jest.Mock).mockReturnValue({
			heap_size_limit: 100,
			total_available_size: 90
		});
		expect(generator.maybeGenerateCoreDump()).toBeFalsy();
		expect(dumpme).not.toBeCalled();
		expect(fs.renameSync).not.toBeCalled();
	});

	it("should not create coredump when GC frees enough memory", () => {
		(v8.getHeapStatistics as jest.Mock).mockReturnValueOnce({
			heap_size_limit: 100,
			total_available_size: 5
		});
		(v8.getHeapStatistics as jest.Mock).mockReturnValueOnce({
			heap_size_limit: 100,
			total_available_size: 30
		});
		expect(generator.maybeGenerateCoreDump()).toBeFalsy();
		expect(v8.getHeapStatistics).toBeCalledTimes(2);
		expect(dumpme).not.toBeCalled();
		expect(fs.renameSync).not.toBeCalled();
	});

	it("should create coredump when GC cannot free enough memory", () => {
		(v8.getHeapStatistics as jest.Mock).mockReturnValue({
			heap_size_limit: 100,
			total_available_size: 5
		});
		expect(generator.maybeGenerateCoreDump()).toBeTruthy();
		expect(dumpme).toBeCalled();
		expect(fs.renameSync).toBeCalledWith(`${process.cwd()}/core.${process.pid.toString()}`, `${process.cwd()}/core.${process.pid.toString()}.outofmem`);
	});

	it("should create only a single coredump file", () => {
		(v8.getHeapStatistics as jest.Mock).mockReturnValue({
			heap_size_limit: 100,
			total_available_size: 5
		});
		expect(generator.maybeGenerateCoreDump()).toBeTruthy();
		expect(generator.maybeGenerateCoreDump()).toBeFalsy();
		expect(dumpme).toBeCalledTimes(1);
	});
});
