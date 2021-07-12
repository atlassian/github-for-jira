import stream from 'stream';

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
  const writable = new stream.Writable({
    write: function(chunk, encoding, next) {
      if (!shouldBeFiltered(chunk)) {
        out.write(chunk, encoding)
      }
      next();
    }
  });
  return writable
}


const shouldBeFiltered = (chunk: any) : boolean => {
  return chunk.includes && (chunk.includes("GET /")
    || chunk.includes("POST /") || chunk.includes("DELETE /"))
}


export default filteringStream
