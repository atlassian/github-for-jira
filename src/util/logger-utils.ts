import { Writable } from "stream";
import safeJsonStringify from "safe-json-stringify";
import bformat from "bunyan-format";
import { createHashWithSharedSecret } from "utils/encryption";

const SENSITIVE_DATA_FIELDS = ["jiraHost", "orgName", "repoName", "userGroup", "userGroup", "aaid", "username"];
// For any Micros env we want the logs to be in JSON format.
// Otherwise, if local development, we want human readable logs.
const outputMode = process.env.MICROS_ENV ? "json" : "short";

//TODO Remove this code when there will be convenient way to do it in Probot.
//  See https://github.com/probot/probot/issues/1577
export const filterHttpRequests = (record: Record<string, any>, filteredLoggerName: string) => {
	const { msg, name } = record;
	if (name !== filteredLoggerName) {
		return false;
	}
	return !!msg.match(/(GET|POST|DELETE|PUT|PATCH)/);
};

export class RawLogStream extends Writable {
	private readonly  filteredHttpLoggerName: string;
	private readonly unsafeStream: boolean;
	private writeStream: NodeJS.WritableStream;

	public constructor(filteredHttpLoggerName: string, unsafeStream = false) {
		super({ objectMode: true });
		this.filteredHttpLoggerName = filteredHttpLoggerName;
		this.unsafeStream = unsafeStream;
		this.writeStream = bformat({ outputMode, levelInString: true });
	}

	public async _write(record: any, encoding: BufferEncoding, next): Promise<void> {
		const featureFlags = await import("config/feature-flags");
		const { booleanFlag, BooleanFlags } = featureFlags;

		// Skip unwanted logs
		if (filterHttpRequests(record, this.filteredHttpLoggerName)) {
			return next();
		}

		// Skip unsafe logging if no jiraHost or false feature flag for JiraHost
		// if (this.unsafeStream && !record.jiraHost) {
		if (this.unsafeStream && (!record.jiraHost || !await booleanFlag(BooleanFlags.LOG_UNSAFE_DATA, false, record.jiraHost))) {
			return next();
		}

		const recordClone = { ...record };

		// hash sensitive data or tag it unsafe
		if (this.unsafeStream) {
			this.tagUnsafeData(recordClone);
		} else {
			this.hashSensitiveData(recordClone);
		}

		const chunk = safeJsonStringify(recordClone) + "\n";
		this.writeStream.write(chunk, encoding, (err) => {
			if (err) {
				console.error(err);
			}
		});
		next();
	}

	private tagUnsafeData(record: Record<string, any>): void {
		record.env_suffix = "unsafe";
	}

	private hashSensitiveData(record: Record<string, any>): void {
		Object.keys(record).forEach(key => {
			if (SENSITIVE_DATA_FIELDS.includes(key)) {
				record[key] = createHashWithSharedSecret(record[key]);
			}
		});
	}

}
