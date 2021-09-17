import { queues } from "./main";
import { getLogger } from "../config/logger";

const logger = getLogger("deduplicate-installations");

export const deduplicateInstallations = async() : Promise<number> => {
	// This remove all jobs from the queue. This way,
	// the whole queue will be drained and all jobs will be readded.
	const jobs = await queues.installation.getJobs(["active", "delayed", "waiting", "paused"]);
	const foundInstallationIds = new Set<number>();
	const duplicateJobs = [];

	// collecting duplicate jobs per installation
	for (const job of jobs) {
		if (!job) {
			continue;
		}
		if (foundInstallationIds.has(job.data.installationId)) {
			duplicateJobs.push(job);
		} else {
			foundInstallationIds.add(job.data.installationId);
		}
	}

	// removing duplicate jobs
	await Promise.all(duplicateJobs.map((job) => {
		logger.info({ job }, "removing duplicate job");
		job.remove();
	}));

	return duplicateJobs.length;
}
