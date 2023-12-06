import { Subscription, SyncStatus } from "models/subscription";
import { TaskType, SyncType } from "~/src/sync/sync.types";


const MILLISECONDS_IN_ONE_DAY = 24 * 60 * 60 * 1000;
export const getStartTimeInDaysAgo = (commitsFromDate: Date | undefined) => {
	if (commitsFromDate === undefined) return undefined;
	return Math.floor((Date.now() -  commitsFromDate?.getTime()) / MILLISECONDS_IN_ONE_DAY);
};

type SyncTypeAndTargetTasks = {
	syncType: SyncType,
	targetTasks: TaskType[] | undefined,
};

export const determineSyncTypeAndTargetTasks = (syncTypeFromReq: string, subscription: Subscription): SyncTypeAndTargetTasks => {
	if (syncTypeFromReq === "full") {
		return { syncType: "full", targetTasks: undefined };
	}

	if (subscription.syncStatus === SyncStatus.FAILED) {
		return { syncType: "full", targetTasks: undefined };
	}

	return { syncType: "partial", targetTasks: ["pull", "branch", "commit", "build", "deployment", "dependabotAlert", "secretScanningAlert", "codeScanningAlert"] };
};