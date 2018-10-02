/*
 * Copied from https://github.com/maxogden/github-oauth/blob/master/index.js
 * But it had a vulnerability on the `request` package version range.
 * So, instead of making a fork, since it's only one file and the package
 * hasn't been updated in 3 years I thought it was simpler to just copy the source here
 */
var request = require('request')
var events = require('events')
var url = require('url')
var crypto = require('crypto')

const host = process.env.GHE_HOST || 'github.com'

module.exports = function (opts) {
  if (!opts.callbackURI) opts.callbackURI = '/github/callback'
  if (!opts.loginURI) opts.loginURI = '/github/login'
  if (typeof opts.scope === 'undefined') opts.scope = 'user'
  var state = crypto.randomBytes(8).toString('hex')
  var urlObj = url.parse(opts.baseURL)
  urlObj.pathname = url.resolve(urlObj.pathname, opts.callbackURI)
  var redirectURI = url.format(urlObj)
  var emitter = new events.EventEmitter()

  function addRoutes (router, loginCallback) {
    // compatible with flatiron/director
    router.get(opts.loginURI, login)
    router.get(opts.callbackURI, callback)
    if (!loginCallback) return
    emitter.on('error', function (token, err, resp, tokenResp, req) {
      loginCallback(err, token, resp, tokenResp, req)
    })
    emitter.on('token', function (token, resp, tokenResp, req) {
      loginCallback(false, token, resp, tokenResp, req)
    })
  }

  function login (req, resp) {
    var u = 'https://' + host + '/login/oauth/authorize' +
        '?client_id=' + opts.githubClient +
        (opts.scope ? '&scope=' + opts.scope : '') +
        '&redirect_uri=' + redirectURI +
        '&state=' + state

    resp.statusCode = 302
    resp.setHeader('location', u)
    resp.end()
  }

  function callback (req, resp, cb) {
    var query = url.parse(req.url, true).query
    var code = query.code
    if (!code) return emitter.emit('error', {error: 'missing oauth code'}, resp)
    var u = 'https://' + host + '/login/oauth/access_token' +
       '?client_id=' + opts.githubClient +
       '&client_secret=' + opts.githubSecret +
       '&code=' + code +
       '&state=' + state

    request.get({url: u, json: true}, function (err, tokenResp, body) {
      if (err) {
        if (cb) {
          err.body = body
          err.tokenResp = tokenResp
          return cb(err)
        }
        return emitter.emit('error', body, err, resp, tokenResp, req)
      }
      if (cb) {
        cb(null, body)
      }
      emitter.emit('token', body, resp, tokenResp, req)
    })
  }

  emitter.login = login
  emitter.callback = callback
  emitter.addRoutes = addRoutes
  return emitter
}
