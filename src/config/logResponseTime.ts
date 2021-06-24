import {Request, Response, NextFunction} from 'express';
import bunyan from 'bunyan';

export const logResponseTime = (req: Request, res: Response, next: NextFunction) => {
  const logger = bunyan.createLogger({ name: 'Log response time' });
  const startHrTime = process.hrtime();

  res.on("finish", () => {
    const elapsedHrTime = process.hrtime(startHrTime);
    const elapsedTimeInMs = elapsedHrTime[0] * 1000 + elapsedHrTime[1] / 1e6;
    logger.info("%s : %fms", req.path, elapsedTimeInMs);
  });

  next();
}
