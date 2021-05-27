/* eslint-disable @typescript-eslint/no-explicit-any */
import testdouble, {TestDouble} from "testdouble";
import Nock from "nock";
import {Url} from 'url';
import tdJest from 'testdouble-jest';
import tdNock from 'testdouble-nock';


declare global {
  let nock: (basePath: string | RegExp | Url, options?: Nock.Options) => Nock.Scope;
  let td: TestDouble<any>;
}


beforeAll(() => {
  nock = Nock;
  td = testdouble;
  tdJest(td, jest);
  tdNock(td, nock);
});

afterEach(() => td.reset());
