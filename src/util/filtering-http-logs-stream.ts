import { Writable } from "stream";

/**
 * Creates a writable stream that prevents HTTP logs from being logged
 *
 * It is done to filter out HTTP logs which are coming from Probot's middleware. Default one would log all query parameters,
 * jwt tokens etc... not good.
 *
 * Unfortunately there is no other way to disable these logs:
 * https://github.com/probot/probot/issues/1577
 *
 * @name filteringHttpLogsStream
 * @function
 * @param filteringLoggerName - the name of the logger to watch
 * @param out {Stream} original stream
 * @return {Writable} that you can pipe bunyan output into
 */
export const filteringHttpLogsStream = (filteringLoggerName: string, out: Writable = process.stdout): Writable =>
	new Writable({
		write: (chunk: unknown, encoding: BufferEncoding, next) => {
			//TODO Remove this code when there will be convenient way to do it in Probot.
			//See https://github.com/probot/probot/issues/1577
			if (String(chunk).match(`${filteringLoggerName}.*(GET|POST|DELETE|PUT|PATCH) /`)) {
				out.write(chunk, encoding);
			}
			next();
		}
	});
