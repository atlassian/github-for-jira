import { RateLimitState, StepProcessor, StepResult } from "./looper/api";
import { JobState } from "./index";
import { Prioritizer } from "./prioritizer";

export class PullRequestProcessor implements StepProcessor<JobState>{

	private readonly prioritizer: Prioritizer;

	constructor(prioritizer: Prioritizer) {
		this.prioritizer = prioritizer;
	}

	process(jobState: JobState, _?: RateLimitState): StepResult<JobState> {
		this.prioritizer;
		return {
			success: true,
			jobState: jobState
		};
	}


}
