
import { Request } from "express";

export function getPayload(request: Request): Promise<object> {
	if (request.body) {
		return Promise.resolve(request.body as object);
	}

	return new Promise((resolve, reject) => {
		let data = "";

		request.setEncoding("utf8");

		request.on("error", (error: Error) => reject(error));
		request.on("data", (chunk: string) => (data += chunk));
		request.on("end", () => {
			try {
				resolve(JSON.parse(data));
			} catch (error) {
				error.message = "Invalid JSON";
				error.status = 400;
				reject(error);
			}
		});
	});
}
