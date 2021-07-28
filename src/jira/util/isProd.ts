import { EnvironmentEnum } from "../../config/env";

export default () => process.env.NODE_ENV === EnvironmentEnum.production;
