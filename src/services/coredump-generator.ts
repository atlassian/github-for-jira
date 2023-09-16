import Logger from "bunyan";
import v8 from "v8";
import dumpme from "dumpme";
import fs from "fs";

export class CoredumpGenerator {
	private config: {
		logger: Logger,
		memLeftPctThesholdBeforeGc: number,
		memLeftPctThesholdAfterGc: number
	};

	private coreDumpGenerated = false;

	constructor(config: {
		logger: Logger,
		memLeftPctThesholdBeforeGc: number,
		memLeftPctThesholdAfterGc: number
	}) {
		this.config = config;
	}

	private getFreeHeapPercentage() {
		const heapStatistics = v8.getHeapStatistics();
		const heapSizeLimit = heapStatistics.heap_size_limit;
		const totalAvailableSize = heapStatistics.total_available_size;

		// Calculate the percentage of free heap size
		return (totalAvailableSize / heapSizeLimit) * 100;
	}

	public maybeGenerateCoreDump(): boolean {
		if (this.coreDumpGenerated) {
			return false;
		}

		const freeHeapPctBeforeGc = this.getFreeHeapPercentage();
		this.config.logger.info(`Free heap size before GC is ${freeHeapPctBeforeGc}%`);

		if (freeHeapPctBeforeGc < this.config.memLeftPctThesholdBeforeGc) {

			const timestampBeforeGc = Date.now();
			this.config.logger.info(`Free heap size is less than ${this.config.memLeftPctThesholdBeforeGc}. Triggering GC...`);
			global.gc?.call(global);
			const timestampAfterGc = Date.now();

			this.config.logger.info(`GC work is over, took ${timestampAfterGc - timestampBeforeGc}`);
			const freeHeapPctAfterGc = this.getFreeHeapPercentage();

			if (freeHeapPctAfterGc < this.config.memLeftPctThesholdAfterGc) {

				this.config.logger.info(`Free heap size after GC is ${freeHeapPctAfterGc}, which is less than ${this.config.memLeftPctThesholdAfterGc}, creating coredump`);
				dumpme(undefined, `/tmp/core.${process.pid.toString()}`);
				const timestampAfterCoreDump = Date.now();
				this.config.logger.info(`Core dump was created, took ${timestampAfterCoreDump - timestampAfterGc}`);

				fs.renameSync(`/tmp/core.${process.pid.toString()}`, `/tmp/core.${process.pid.toString()}.ready`);
				this.coreDumpGenerated = true;
				return true;

			} else {
				this.config.logger.info(`Free heap size after GC is ${freeHeapPctAfterGc}, which more than ${this.config.memLeftPctThesholdAfterGc}, do nothing`);
			}
		}
		return false;
	}
}
