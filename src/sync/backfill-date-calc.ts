import Logger from "bunyan";
import { convertCommitsFromDateStringToDate } from "~/src/sync/sync-utils";

export const calcNewBackfillSinceDate = (
	existingBackfillSince: Date | undefined,
	backfillSinceInMsgPayload: string | undefined,
	logger: Logger
): Date | undefined  => {

	if (!existingBackfillSince) {
		//this is previously backfilled customers,
		//we assume all data area backfilled,
		//so keep the date empty for ALL_BACKFILLED
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

