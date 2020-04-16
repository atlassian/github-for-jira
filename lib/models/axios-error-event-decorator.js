const url = require('url');

/*
 * Adds request/response metadata to a Sentry event for an Axios error
 * To use, pass AxiosErrorEventDecorator.decorate to scope.addEventProcessor
 *
 * See https://docs.sentry.io/platforms/node/#eventprocessors
 */
class AxiosErrorEventDecorator {
  static decorate(event, hint) {
    const decorator = new AxiosErrorEventDecorator(event, hint);
    return decorator.decorate();
  }

  constructor(event, hint) {
    this.event = event;
    this.hint = hint;
  }

  get error() {
    return this.hint.originalException;
  }

  get response() {
    return this.error.response;
  }

  get request() {
    return this.response.request;
  }

  validError() {
    return this.error && this.response && this.request;
  }

  decorate() {
    if (!this.validError()) {
      return this.event;
    }

    this.event.extra.response = this.responseMetadata();
    this.event.extra.request = this.requestMetadata();
    this.event.fingerprint = this.generateFingerprint();

    return this.event;
  }

  requestMetadata() {
    const metadata = {
      method: this.request.method,
      path: this.request.path,
      host: this.request.getHeader('host'),
      headers: this.request.getHeaders(),
    };

    const requestBody = this.response.config.data;
    if (requestBody) {
      metadata.body = this.parseRequestBody(requestBody);
    }

    return metadata;
  }

  responseMetadata() {
    const metadata = {
      status: this.response.status,
      headers: this.response.headers,
    };

    if (this.response.data) {
      metadata.body = this.response.data.slice(0, 255);
    }

    return metadata;
  }

  generateFingerprint() {
    const { pathname } = url.parse(this.request.path);

    return [
      '{{ default }}',
      this.response.status,
      `${this.request.method} ${pathname}`,
    ];
  }

  /*
   * Parse JSON body, when present and valid, otherwise return unparsed body.
   */
  parseRequestBody(body) {
    if (this.isJsonRequest()) {
      try {
        return JSON.parse(body);
      } catch (error) {
        if (error.name !== 'SyntaxError') {
          throw error;
        }
      }
    }

    return body;
  }

  isJsonRequest() {
    return this.request.getHeader('content-type').startsWith('application/json');
  }
}

module.exports = AxiosErrorEventDecorator;
