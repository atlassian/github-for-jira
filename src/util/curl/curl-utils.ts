import { exec as execOrigin } from "child_process";
import { promisify } from "util";
import _ from "lodash";
import Logger from "bunyan";

const exec = promisify(execOrigin);

const encodeBase64 = (str: string): string => {
	const buffer = Buffer.from(str, "utf-8");
	const base64 = buffer.toString("base64");
	return base64;
};

const splitStringToChunks = (str: string, chunkSize: number): string[] => {
	const charArray = str.split("");
	const charChunks = _.chunk(charArray, chunkSize);
	return charChunks.map(chunk => chunk.join(""));
};

export const runCurl = async (opts: {
	fullUrl: string,
	method: "GET" | "POST",
	authorization: string
}) => {
	const methodFlag = opts.method === "GET" ? "" : `-X ${opts.method}`;
	const cmd = `curl -s -v ${methodFlag} -H "Accept: application/json" -H "Authorization: ${opts.authorization}" '${opts.fullUrl}'`;
	const { stdout = "", stderr = "" } = await exec(cmd, {
		env: {
			...process.env
		}
	});
	let meta = stderr;
	meta = _.replace(meta, new RegExp(_.escapeRegExp(opts.authorization), "g"), "******");
	meta = _.replace(meta, new RegExp("set-cookie.+", "g"), "");
	return {
		body: stdout,
		meta
	};
};

// In case payload is too large, it might be truncated by a logger when logged as it is. Use this one for such case
export const logCurlOutputInChunks = (output: { body: string; meta: string }, logger: Logger) => {
	logger.warn({ body: output.body }, "Curl body");
	const metaChunked = splitStringToChunks(encodeBase64(output.meta), 128).map((chunk) => `...${chunk}...`);
	metaChunked.forEach((metaChunk, metaChunkIdx) => {
		logger.warn({ metaChunk, metaChunkIdx, metaChunksCount: metaChunked.length }, `Curl split(base64(metaChunk)), index ${metaChunkIdx}`);
	});
};

