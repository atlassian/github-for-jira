import { JobState, StepProcessor, StepResult } from "./backfill.types";

export class PullRequestProcessor implements StepProcessor<JobState> {
	process(jobState: JobState): StepResult<JobState> {
		return {
			success: true,
			jobState: jobState
		};
	}

}
