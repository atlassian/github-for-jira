const featureFlags = () => FRONTEND_FEATURE_FLAGS ?
	JSON.parse(JSON.stringify(FRONTEND_FEATURE_FLAGS)) : null;
export const enableBackfillStatusPage = featureFlags()?.ENABLE_5KU_BACKFILL_PAGE;
