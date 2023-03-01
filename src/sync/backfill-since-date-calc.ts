import { SyncType } from "~/src/sync/sync.types";

export const calcNewBackfillSinceDate = (
	existingBackfillSince: Date | undefined,
	commitsFromDate: Date | undefined,
	syncType: SyncType | undefined
): Date | undefined  => {

	if (syncType === "partial" || syncType === undefined) {
		//do not change anything on partial sync
		//or missing sync type on mgs body
		//( which means old msg before the prod deployment )
		return existingBackfillSince;
	}

	if (!existingBackfillSince) {
		//this is previously backfilled customers,
		//we assume all data area backfilled,
		//so keep the date empty for ALL_BACKFILLED
		return existingBackfillSince;
	}

	if (!commitsFromDate) {
		//something wrong, just ignore it, use the origin date
		return existingBackfillSince;
	}

	if (existingBackfillSince.getTime() <= commitsFromDate.getTime()) {
		//Origin backfill date is either empty or earlier,
		//So use the origin one.
		return existingBackfillSince;
	}

	//The new backfill date is earlier then the origin one
	//Use the new backfill date
	return commitsFromDate;
};

