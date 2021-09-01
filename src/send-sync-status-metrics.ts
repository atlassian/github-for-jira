import dotenv from "dotenv";
import { queues } from "./worker/main";
import logger from "./config/logger";

dotenv.config();

queues.metrics.add({})
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error({...error}, "An error occurred while enqueuing the metrics job");
		process.exit(1);
	});
