import { EnvironmentEnum } from "interfaces/common";

export const getNodeEnv: () => EnvironmentEnum = () => EnvironmentEnum[process.env.NODE_ENV || ""] as EnvironmentEnum || EnvironmentEnum.development;
export const isNodeEnv = (env: EnvironmentEnum) => getNodeEnv() === env;
export const isNodeProd = () => isNodeEnv(EnvironmentEnum.production);
export const isNodeDev = () => isNodeEnv(EnvironmentEnum.development);
export const isNodeTest = () => isNodeEnv(EnvironmentEnum.test);
