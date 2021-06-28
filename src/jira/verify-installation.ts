import * as Sentry from '@sentry/node';
import getAxiosInstance from './client/axios';
import Installation from '../models/installation';
import Logger from 'bunyan';

export default (installation: Installation, log: Logger) => {
  return async (): Promise<void> => {
    const instance = getAxiosInstance(
      installation.jiraHost,
      installation.sharedSecret,
      log,
    );

    const transaction = Sentry.startTransaction({
      op: 'test',
      name: 'My First Test Transaction',
    });

    setTimeout(() => {
      try {
        // eslint-disable-next-line @typescript-eslint/ban-ts-comment
        // @ts-ignore
        foo();
      } catch (e) {
        Sentry.captureException(e);
      } finally {
        transaction.finish();
      }
    }, 99);

    try {
      const result = await instance.get(
        '/rest/devinfo/0.10/existsByProperties?fakeProperty=1',
      );
      if (result.status === 200) {
        log.info(`Installation id=${installation.id} enabled on Jira`);
        await installation.enable();
      } else {
        const message = `Unable to verify Jira installation: ${installation.jiraHost} responded with ${result.status}`;
        log.warn(message);
        Sentry.captureMessage(message);
      }
    } catch (err) {
      if (err.response?.status === 401) {
        log.warn(
          `Jira does not recognize installation id=${installation.id}. Deleting it`,
        );
        await installation.destroy();
      } else {
        log.error(
          `Unhandled error while verifying installation id=${installation.id}: ${err}`,
        );
        Sentry.captureException(err);
      }
    }
  };
};
