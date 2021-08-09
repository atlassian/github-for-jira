const applicationinsights = require('applicationinsights');

if (process.env.APPINSIGHTS_INSTRUMENTATIONKEY) {
  applicationinsights.setup(process.env.APPINSIGHTS_INSTRUMENTATIONKEY).setAutoCollectConsole(true, true);
  applicationinsights.start();
}

module.exports.AppInsightsLogger = class AppInsightsLogger {
  constructor() {
    this.client = applicationinsights.defaultClient;
  }
  error(...msgs) {
    this.client.trackException({ exception: new Error(msgs.filter(item => item).map(JSON.stringify).join(' ')) });
  }
  warn(...msgs) {
    this.client.trackTrace({ message: msgs.filter(item => item).map(JSON.stringify).join(' '), severity: 2 });
  }
  debug(...msgs) {
    this.client.trackTrace({ message: msgs.filter(item => item).map(JSON.stringify).join(' '), severity: 1 });
  }
  info(...msgs) {
    this.client.trackTrace({ message: msgs.filter(item => item).map(JSON.stringify).join(' '), severity: 0 });
  }
};
