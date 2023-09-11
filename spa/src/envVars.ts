import { envVarsType } from "rest-interfaces";

// TODO: need to add the env variables from the node app somehow
const envVars: envVarsType = {
	LAUNCHDARKLY_CLIENT_KEY: process.env.REACT_APP_LAUNCHDARKLY_CLIENT_KEY || "",
	GLOBAL_HASH_SECRET: process.env.REACT_APP_GLOBAL_HASH_SECRET || ""
};

export default envVars;
