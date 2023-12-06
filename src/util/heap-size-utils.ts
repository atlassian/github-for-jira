import Logger from "bunyan";
import v8 from "v8";

export const getFreeHeapPct = () => {
	const heapStatistics = v8.getHeapStatistics();
	const heapSizeLimit = heapStatistics.heap_size_limit;
	const totalAvailableSize = heapStatistics.total_available_size;

	return (totalAvailableSize / heapSizeLimit) * 100;
};

/**
 * IMPORTANT: the call is quite expensive and may block the main thread, don't call it unnecessarily often
 *
 * Return false if and only if the free available heap size is less than "notEnoughHeapPctThreshold", even after GC.
 */
export const hasEnoughFreeHeap = (notEnoughHeapPctThreshold: number, logger: Logger): boolean => {
	const freeHeapPctBeforeGc = getFreeHeapPct();

	if (freeHeapPctBeforeGc < notEnoughHeapPctThreshold) {
		const timestampBeforeGc = Date.now();
		logger.info(`Free heap size is less than ${notEnoughHeapPctThreshold}. Triggering GC...`);
		// eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
		global.gc?.call(global);
		const timestampAfterGc = Date.now();

		const freeHeapPctAfterGc = getFreeHeapPct();
		logger.info(`GC work is over, took ${timestampAfterGc - timestampBeforeGc}. Heap size: ${freeHeapPctAfterGc}`);

		return (freeHeapPctAfterGc > notEnoughHeapPctThreshold);
	} else {
		// No need to trigger GC: there's already plenty of memory
	}

	return true;
};
