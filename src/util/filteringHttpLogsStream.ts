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
 * @return {WritableStream} that you can pipe bunyan output into
 */
const filteringHttpLogsStream = (filteringLoggerName: string, out) => {
	//TODO Remove this code when there will be convenient way to do it in Probot.
	//See https://github.com/probot/probot/issues/1577
	const shouldBeFiltered = (chunk: any): boolean => {
		return !!chunk.toString().match(`${filteringLoggerName}.*(GET|POST|DELETE|PUT|PATCH) /`);
	};

	const writable = new Writable({
		write: function(chunk, encoding, next) {
			if (!shouldBeFiltered(chunk)) {
				out.write(chunk, encoding);
			}
			next();
		}
	});
	return writable;
};

export default filteringHttpLogsStream;
