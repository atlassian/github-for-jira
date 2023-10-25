import { getFreeHeapPct, hasEnoughFreeHeap } from "utils/heap-size-utils";
import v8 from "v8";
import { getLogger } from "config/logger";

jest.mock("v8");

describe("heap-size-utils", function () {
	describe("getFreeHeapPct", () => {
		beforeEach(() => {
			(v8.getHeapStatistics as jest.Mock).mockReturnValue({
				heap_size_limit: 100,
				total_available_size: 90
			});
		});

		it("correctly calculates getFreeHeapPct", () => {
			expect(getFreeHeapPct()).toStrictEqual(90);
		});
	});

	describe("hasEnoughFreeHeap", () => {
		it("returns true if there's plenty of heap", () => {
			(v8.getHeapStatistics as jest.Mock).mockReturnValue({
				heap_size_limit: 100,
				total_available_size: 90
			});
			expect(hasEnoughFreeHeap(80, getLogger("test"))).toBeTruthy();
		});

		it("returns true if there was not enough free heap but then GC freed some", () => {
			(v8.getHeapStatistics as jest.Mock).mockReturnValueOnce({
				heap_size_limit: 100,
				total_available_size: 70
			});
			(v8.getHeapStatistics as jest.Mock).mockReturnValueOnce({
				heap_size_limit: 100,
				total_available_size: 90
			});
			expect(hasEnoughFreeHeap(80, getLogger("test"))).toBeTruthy();
		});

		it("returns false if there wasn't enough free heap and GC couldn't release more", () => {
			(v8.getHeapStatistics as jest.Mock).mockReturnValueOnce({
				heap_size_limit: 100,
				total_available_size: 70
			});
			(v8.getHeapStatistics as jest.Mock).mockReturnValueOnce({
				heap_size_limit: 100,
				total_available_size: 72
			});
			expect(hasEnoughFreeHeap(80, getLogger("test"))).toBeFalsy();
		});
	});
});
