// Temp utility functions while we are investigating why worker node.js processes die.

let stopped = false;
export const stopHealthcheck = () => {
	stopped = true;
};

export const isHealthcheckStopped = () => {
	return stopped;
};
