/* eslint-disable @typescript-eslint/no-explicit-any,@typescript-eslint/no-var-requires */
import {TestDouble} from 'testdouble';
import Nock from 'nock';
import * as NockFunction from 'nock';

declare global {
  let nock: typeof Nock;
  let td: TestDouble<any>;

  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace NodeJS {
    interface Global {
      nock: typeof NockFunction;
      td: TestDouble<any>;
    }
  }
}

// DO NOT TOUCH, EXTREMELY FLAKY WITH TS
global.nock = require('nock');
global.td = require('testdouble');

beforeAll(() => {
  require('testdouble-jest')(td, jest);
  require('testdouble-nock')(td, nock);
});

afterEach(() => {
  td.reset();
});
