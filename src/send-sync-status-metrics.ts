import dotenv from "dotenv";
import logger from "./config/logger";
import { queues } from "./worker/queues";

dotenv.config();

queues.metrics.add({})
	.then(() => process.exit(0))
	.catch((error) => {
		logger.error(error, "An error occurred while enqueuing the metrics job");
		process.exit(1);
	});
