import { envVarsType } from "rest-interfaces";

const envVars: envVarsType = {
	LAUNCHDARKLY_CLIENT_KEY: process.env.REACT_APP_LAUNCHDARKLY_CLIENT_KEY || "",
	GLOBAL_HASH_SECRET: process.env.REACT_APP_GLOBAL_HASH_SECRET || ""
};

export default envVars;
