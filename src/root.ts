/* eslint-disable @typescript-eslint/ban-ts-comment */
// This allows TypeScript to detect our global value
// @ts-ignore
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      __rootdir__: string;
    }
  }
}

// @ts-ignore
global.__rootdir__ = __dirname || process.cwd();
