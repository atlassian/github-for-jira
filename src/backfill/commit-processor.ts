import { RateLimitState, StepProcessor, StepResult } from "./looper/api";
import { JobState } from "./index";

export class CommitProcessor implements StepProcessor<JobState> {

	process(jobState: JobState, _?: RateLimitState): StepResult<JobState> {
		return {
			success: true,
			jobState: jobState
		};
	}


}
