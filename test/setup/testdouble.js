global.nock = require('nock')
global.td = require('testdouble')

beforeAll(() => {
  require('testdouble-jest')(td, jest)
  require('testdouble-nock')(td, nock)
})

afterEach(() => {
  td.reset()
})
