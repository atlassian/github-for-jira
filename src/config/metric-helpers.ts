export const repoCountToBucket = (repoNum: number | undefined) => {
	if (repoNum === undefined) return "unknown";
	const roughly = Math.floor(repoNum / 100);
	if (roughly < 1) return "0-100";
	if (roughly < 10) return "100-1000";
	return "1000+";
};

const ONE_DAY_BUFFER_IN_SECS = 24 * 60 * 60;
//following calculation all with one day as buffer,
//just so to compensate any timezone, edge case problem.
//Result will be if the sync time is 32 days, we still, from metrics point of view, think it is just a month of data
const THIRTY_DAYS_IN_SEC = (31 + 1) * ONE_DAY_BUFFER_IN_SECS;
const HALF_YEAR_IN_SEC = (Math.ceil(365/2) + 1) * ONE_DAY_BUFFER_IN_SECS;
const ONE_YEAR_IN_SEC = (365 + 1) * ONE_DAY_BUFFER_IN_SECS;
export const backfillFromDateToBucket = (backfillFromDate: Date | undefined) => {
	if (!backfillFromDate) return "all-time";
	const diff = new Date().getTime() - backfillFromDate.getTime();
	if (diff < 0) return "unknown";
	const diffInSec = Math.floor(diff/1000);
	if (diffInSec <= THIRTY_DAYS_IN_SEC) return "0-30";
	if (diffInSec <= HALF_YEAR_IN_SEC) return "30-180";
	if (diffInSec <= ONE_YEAR_IN_SEC) return "180-365";
	return "365+";
};
