import Logger from "bunyan";

export class Tracer {
	private readonly startTimestamp: number;
	private readonly logsEnabled: boolean;
	private readonly logger: Logger;

	constructor(log: Logger, name: string, logsEnabled: boolean) {
		this.logger = log.child({ tracer: name });
		this.startTimestamp = new Date().getTime();
		this.logsEnabled = logsEnabled;
	}

	trace(message: string) {
		if (this.logsEnabled) {
			this.logger.info(`time: ${this.getElapsedMs()}ms - ${message}`);
		}
	}

	private getElapsedMs() {
		const now = new Date().getTime();
		return now - this.startTimestamp;
	}
}
