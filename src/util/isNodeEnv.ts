import { EnvironmentEnum } from "../interfaces/common";

export const getNodeEnv = () => process.env.NODE_ENV || EnvironmentEnum.development;
export const isNodeEnv = (env: EnvironmentEnum) => getNodeEnv() === env;
export const isNodeProd = () => isNodeEnv(EnvironmentEnum.production);
export const isNodeDev = () => isNodeEnv(EnvironmentEnum.development);
export const isNodeTest = () => isNodeEnv(EnvironmentEnum.test);
