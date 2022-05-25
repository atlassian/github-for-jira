import { createHmac } from "crypto";
import { envVars } from "../config/env";

const getSharedSecret = (): string => {
	return envVars.HASH_SECRET;
}

export const createHashWithSharedSecret = (data): string => {
	const hash = createHmac("sha256", getSharedSecret())
		.update(data)
		.digest("hex");
	return hash;
}