import { RateLimitState, StepProcessor, StepResult } from "./looper/api";
import { JobState } from "./index";

export class BranchProcessor implements StepProcessor<JobState> {

	async process(jobState: JobState, _?: RateLimitState): Promise<StepResult<JobState>> {
		return {
			jobState: jobState
		};
	}


}
