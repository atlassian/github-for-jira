import {Context} from 'probot/lib/context';

const DEFAULT_TIMEOUT = parseInt(process.env.REQUEST_TIMEOUT_MS) || 25000;

export class TimeoutContext extends Context {
  timedout?:number;
}

export default (callback:(context:TimeoutContext) => Promise<never>, timeout = DEFAULT_TIMEOUT) =>
  async (context: TimeoutContext):Promise<void> => {
    const timestamp = Date.now();
    const id = setTimeout(() => context.timedout = Date.now() - timestamp, timeout);
    try {
      await callback(context);
    } finally {
      clearTimeout(id);
    }
}
