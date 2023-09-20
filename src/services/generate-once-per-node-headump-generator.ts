import Logger from "bunyan";
import fs from "fs";
import { hasEnoughFreeHeap } from "utils/heap-size-utils";
import v8 from "v8";

const LOCk_FILE_PATH = "/tmp/hd_generated";

/**
 * Taking heapdump is very expensive, therefore it can be triggered only once per EC2 per the whole lifetime of the node!
 */
export class GenerateOncePerNodeHeadumpGenerator {
	private config: {
		logger: Logger,
		lowHeapAvailPct: number,
	};

	constructor(config: {
		logger: Logger,
		lowHeapAvailPct: number,
	}) {
		this.config = config;
	}

	public maybeGenerateDump() {
		if (this.generatedEarlier()) {
			return false;
		}

		if (!hasEnoughFreeHeap(this.config.lowHeapAvailPct, this.config.logger)) {
			this.markAsGeneratedEarlier();

			this.config.logger.info(`Triggering heapdump...`);

			const heapSnapshotStream = v8.getHeapSnapshot();
			const writeStream = fs.createWriteStream("/tmp/dump_heap.generating");

			heapSnapshotStream.pipe(writeStream);

			writeStream.on("finish", () => {
				this.config.logger.info("Heapdump was generated and saved!");
				fs.renameSync("/tmp/dump_heap.generating", "/tmp/dump_heap.ready");
			});
			return true;
		}

		return false;
	}

	private generatedEarlier() {
		return fs.existsSync(LOCk_FILE_PATH);
	}

	private markAsGeneratedEarlier() {
		fs.writeFileSync(LOCk_FILE_PATH, new Date().toISOString());
	}
}
