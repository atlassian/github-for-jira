import { BinaryLike, createHmac } from "crypto";
import { envVars } from "../config/env";

export const createHashWithSharedSecret = (data: BinaryLike, secret = envVars.GLOBAL_HASH_SECRET): string => {
	return createHmac("sha256", secret)
		.update(data)
		.digest("hex");
}