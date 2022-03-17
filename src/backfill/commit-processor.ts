import { JobState, StepProcessor, StepResult } from "./backfill.types";

export class CommitProcessor implements StepProcessor<JobState> {
	process(jobState: JobState): StepResult<JobState> {
		return {
			success: true,
			jobState: jobState
		};
	}
}
