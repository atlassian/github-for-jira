import { Writable } from 'stream';
import {middlewareLoggerName} from "../middleware/log-middleware";

/**
 * Creates a writable stream that prevents HTTP logs from being logged
 *
 * It is done to filter out HTTP logs which are coming from Probot.
 * Unfortunately there is no other way to disable these logs.
 *
 * @name filteringStream
 * @function
 * @param out {Stream} original stream
 * @return {WritableStream} that you can pipe bunyan output into
 */
const filteringStream = (out) => {
  const writable = new Writable({
    write: function(chunk, encoding, next) {
      if (!shouldBeFiltered(chunk)) {
        out.write(chunk, encoding)
      }
      next();
    }
  });
  return writable
}

//TODO Remove this code when there will be convenient way to do it in Probot.
//See https://github.com/probot/probot/issues/1577
const shouldBeFiltered = (chunk: any) : boolean => {
  return !!chunk.toString().match(`${middlewareLoggerName}.*(GET|POST|DELETE|PUT|PATCH) /`)

}


export default filteringStream
