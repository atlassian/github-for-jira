export const errorStringFromUnknown = (e : unknown) : string => {
	return e instanceof Error ? e.toString() : "unkown";
};
