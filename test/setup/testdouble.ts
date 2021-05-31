/* eslint-disable @typescript-eslint/no-explicit-any */
import testdouble from 'testdouble';
import {TestDouble} from 'testdouble';
import Nock from 'nock';
import tdJest from 'testdouble-jest';
import tdNock from 'testdouble-nock';
import nockFn from 'nock';


declare global {
  let nock: typeof Nock;
  let td: TestDouble<any>;
}


beforeAll(() => {
  nock = nockFn;
  td = testdouble;
  tdJest(td, jest);
  tdNock(td, nockFn);
});

afterEach(() => {
  td.reset();
});
