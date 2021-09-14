import { EnvironmentEnum } from "../config/env";

export const getEnv = () => process.env.NODE_ENV;
export const isEnv = (env: EnvironmentEnum) => getEnv() === env;
export const isProd = () => isEnv(EnvironmentEnum.production);
export const isDev = () => isEnv(EnvironmentEnum.development);
export const isTest = () => isEnv(EnvironmentEnum.test);
