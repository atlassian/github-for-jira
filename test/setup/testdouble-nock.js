const supportedHttpVerbs = [
  'get',
  'post',
  'put',
  'head',
  'patch',
  'merge',
  'delete',
  'options'
]

module.exports = function (td, nock) {
  td.api = function api (baseURL) {
    const api = td.object(supportedHttpVerbs)
    const scope = nock(baseURL)

    let invocationBody
    let invocationRoute

    const captureRequestBody = (body) => {
      if (!body) {
        return
      }

      invocationBody = JSON.parse(body)
      return body
    }

    const interceptAndValidateRequests = (verb) => (route) => {
      invocationRoute = route
      return true
    }

    const replyToStubbing = (verb) => () => {
      let result
      if (invocationBody) {
        result = api[verb](invocationRoute, invocationBody)
      } else {
        result = api[verb](invocationRoute)
      }

      return result
    }

    for (let verb of supportedHttpVerbs) {
      scope.filteringRequestBody(captureRequestBody)
        .persist()
        .intercept(interceptAndValidateRequests(verb), verb)
        .reply(200, replyToStubbing(verb))
    }

    return api
  }
}
