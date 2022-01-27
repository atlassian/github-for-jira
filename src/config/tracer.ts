import Logger from "bunyan";

export class Tracer {
	private readonly startTimestamp: number;
	private readonly logsEnabled: boolean;
	private readonly logger: Logger;

	constructor(log: Logger, name: string, logsEnabled: boolean) {
		this.logger = log.child({ tracer: name });
		this.startTimestamp = Date.now();
		this.logsEnabled = logsEnabled;
	}

	trace(message: string) {
		if (this.logsEnabled) {
			this.logger.info(`time: ${this.getElapsedMs()}ms - ${message}`);
		}
	}

	private getElapsedMs = () => Date.now() - this.startTimestamp
}
