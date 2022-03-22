import { JobState, StepProcessor, StepResult } from "./backfill.types";

export class BranchProcessor implements StepProcessor<JobState> {
	process(jobState: JobState): StepResult<JobState> {
		return {
			success: true,
			jobState: jobState
		};
	}
}
