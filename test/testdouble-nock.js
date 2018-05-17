/* Nock logs come in the format
 * matching INBOUND_URL to VERB FAKED_URL: DOES_MATCH, e.g.
 * matching https://api.github.com:443/comments/389255151 to PATCH https://api.github.com:443/comments/389255151: true
 */

module.exports = function testdoubleNock (td, nock) {
  td.request = function spyOnRoute (baseUrlToSpy, routeToSpy, verbToSpy) {
    const routeDouble = td.func()
    const baseLength = baseUrlToSpy.startsWith('https://')
      ? baseUrlToSpy.length + ':443'.length
      : baseUrlToSpy.length + ':80'.length

    let verb
    let route
    let body

    function parseLoggerStatements (statement) {
      const pieces = statement.split(' ')

      if (pieces[5] === 'false') {
        return
      }

      verb = pieces[3]
      route = pieces[4].substring(baseLength, pieces[4].length - 1)
    }

    function parseRequestBody (requestBody) {
      body = JSON.parse(requestBody)

      return requestBody
    }

    nock(baseUrlToSpy)
      .log(parseLoggerStatements)
      .filteringRequestBody(parseRequestBody)
      .intercept(routeToSpy, verbToSpy)
      .reply(200, () => routeDouble(body) || {})

    return routeDouble
  }
}
