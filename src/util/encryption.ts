import { BinaryLike, createHmac } from "crypto";
import { envVars } from "../config/env";

export const createHashWithSharedSecret = (data: BinaryLike): string => {
	return createHmac("sha256", envVars.GLOBAL_HASH_SECRET)
		.update(data)
		.digest("hex");
};