/* eslint-disable @typescript-eslint/no-explicit-any */
import * as testdouble from 'testdouble';
import {TestDouble} from 'testdouble';
import * as Nock from 'nock';
import * as tdJest from 'testdouble-jest';
import * as tdNock from 'testdouble-nock';
import nock from 'nock';


declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      nock: typeof Nock;
      td: TestDouble<any>;
    }
  }
}


beforeAll(() => {
  global.nock = nock;
  global.td = testdouble;
  tdJest(global.td, jest);
  tdNock(global.td, global.nock);
});

afterEach(() => global.td.reset());
