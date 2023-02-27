import Logger from "bunyan";
import { convertCommitsFromDateStringToDate } from "~/src/sync/sync-utils";
import { SyncType } from "~/src/sync/sync.types";

export const calcNewBackfillSinceDate = (
	existingBackfillSince: Date | undefined,
	backfillSinceInMsgPayload: string | undefined,
	syncType: SyncType | undefined,
	logger: Logger
): Date | undefined  => {

	if (syncType === "partial" || syncType === undefined) {
		//do not change anything on partial sync or missing sync type on mgs body ( which means old msg before the prod deployment )
		return existingBackfillSince;
	}

	if (!existingBackfillSince) {
		//this is previously backfilled customers,
		//we assume all data area backfilled,
		//so keep the date empty for ALL_BACKFILLED
		return undefined;
	}

	if (!backfillSinceInMsgPayload) {
		return undefined;
	}

	const newBackfillSinceDate = convertCommitsFromDateStringToDate(backfillSinceInMsgPayload, logger);
	if (!newBackfillSinceDate) {
		//something wrong, just ignore it, use the origin date
		return existingBackfillSince;
	}

	if (existingBackfillSince.getTime() > newBackfillSinceDate.getTime()) {
		//The new backfill date is earlier then the origin one
		//Use the new backfill date
		return newBackfillSinceDate;
	} else {
		//Origin backfill date is either empty or earlier,
		//So use the origin one.
		return existingBackfillSince;
	}
};

