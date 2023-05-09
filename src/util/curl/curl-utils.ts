import { getLogger } from "config/logger";
import { exec as execOrigin } from "child_process";
import { promisify } from "util";

const exec = promisify(execOrigin);
const logger = getLogger("curl");

export const runCurl = async (opts: {
	fullUrl: string,
	method: "GET" | "POST",
	authorization: string
}) => {
	const cmd = `curl -v -X ${opts.method} -H "Accept: application/json" -H "Authorization: ${opts.authorization}" '${opts.fullUrl}'`;
	const { stdout, stderr } = await exec(cmd, {
		env: {
			...process.env
		}
	});
	const isSuccess = stderr ? false : true;
	return {
		isSuccess,
		stdout,
		stderr
	};
};

