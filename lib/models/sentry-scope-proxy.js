/*
 * Acts like a Sentry scope. See https://docs.sentry.io/enriching-error-data/scopes/?platform=node#configuring-the-scope
 *
 * Useful in contexts where a Sentry scope isn't available, like within the custom exception class.
 * Use `SentryScopeProxy.processEvent` to propogate the error scope for thrown exceptions.
 *
 * Learn more at https://docs.sentry.io/platforms/node/#eventprocessors
 */
class SentryScopeProxy {
  static processEvent (event, hint) {
    if (hint.originalException.sentryScope) {
      hint.originalException.sentryScope.addTo(event)
    }

    return event
  }

  constructor () {
    this.extra = {}
    this.fingerprint = null
  }

  setExtra (key, value) {
    this.extra[key] = value
  }

  setFingerprint (fingerprint) {
    this.fingerprint = fingerprint
  }

  addTo (event) {
    Object.assign(event.extra, this.extra)

    if (this.fingerprint) {
      event.fingerprint = this.fingerprint
    }
  }
}

module.exports = SentryScopeProxy
