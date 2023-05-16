import { exec as execOrigin } from "child_process";
import { promisify } from "util";
import _ from "lodash";

const exec = promisify(execOrigin);

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

