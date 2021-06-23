import https from 'https';
import axios from 'axios';
import crypto from 'crypto';
import { logger } from 'probot/lib/logger';
import statsd, { asyncDistTimer } from '../config/statsd';
import { Action } from '../proto/v0/action';

export const BaseURL = process.env.HYDRO_BASE_URL;

const axiosInstance = axios.create({
  // Set a short timeout, this are disposable
  timeout: 500,
  httpsAgent: new https.Agent({
    keepAlive: true,
  }),
});
axiosInstance.defaults.headers.common['X-Hydro-App'] = 'jira-integration';

const submissionMetricName = 'hydro.submission';
const postMetricName = 'hydro.dist.post';
const logErrStatuses = {
  400: 'Hydro Missing clientID Header',
  404: 'Hydro Unknown Schema',
  422: 'Hydro Invalid Payload',
  failure: 'Unable to connect to hydro to submit',
};
let disabled = ['true', '1'].includes(process.env.TRACKING_DISABLED);

if (!BaseURL) {
  disabled = true;
  logger.warn('No Hydro Base URL set, disabling tracking');
}

// TODO: change this to getter/setter
export const setIsDisabled = (value: boolean): void => {
  disabled = value;
};

export const isDisabled = (): boolean => disabled;

/**
 * Submit Events to the HTTP Gateway
 *
 * @example
 * ```
 * const data = new Action();
 * action.type = ActionType.CREATED;
 * action.association = Association.SUBSCRIPTION;
 * action.actionSource = ActionSource.WEBHOOK;
 * await submitProto(data);
 * ```
 */
export const submitProto = async (
  protos: Action | Action[],
): Promise<boolean> => {
  if (disabled) {
    return true;
  }
  if (!(protos instanceof Array)) {
    protos = [protos];
  }
  const data = {
    events: protos.map((proto) => ({
      schema: proto.schema,
      value: JSON.stringify(proto),
      cluster: 'potomac',
    })),
  };

  const dataStr = JSON.stringify(data);
  const hmac = crypto.createHmac('sha256', process.env.HYDRO_APP_SECRET || '');
  hmac.update(dataStr);

  /** @type {import('axios').AxiosResponse} */
  let resp;
  /** @type {number|string} */
  let status;
  try {
    const axiosPost = async () =>
      axiosInstance.post(BaseURL, dataStr, {
        headers: {
          Authorization: `Hydro ${hmac.digest('hex')}`,
          'Content-Type': 'application/json',
        },
      });
    resp = await asyncDistTimer(axiosPost, postMetricName)();
    status = resp.status;
    logger.debug('Hydro Protobuf Accepted', data);
  } catch (err) {
    if (err.response == null) {
      // This is not an AxiosError
      logger.error(err);
      status = 'exception';
    } else {
      const axError = err;
      let respData;

      resp = axError.response;
      if (resp == null || resp.status == null) {
        status = 'conn_failure';
      } else {
        status = resp.status;
        respData = resp.data;
      }

      if (status in logErrStatuses) {
        logger.error(logErrStatuses[status], { status, resp: respData, data });
      } else {
        logger.error('Hydro Submission Issue', {
          status,
          resp: respData,
          data,
        });
      }
    }
  }

  // Report counts of each schema type (in case we have a heterogeneous list)
  const protoStats = protos.reduce((accumulator, current) => {
    if (accumulator[current.schema] == null) {
      accumulator[current.schema] = 0;
    }
    accumulator[current.schema] += 1;
    return accumulator;
  }, {});
  Object.entries(protoStats).forEach((stats) => {
    const [name, count] = stats;

    const tags = [
      `schema:${name}`,
      `status:${status}`,
      `environment: ${process.env.NODE_ENV}`,
      `environment_type: ${process.env.MICROS_ENVTYPE}`,
    ];

    statsd.increment(submissionMetricName, count as number, tags);
  });

  return status === 200;
};
