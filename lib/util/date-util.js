const moment = require('moment');

module.exports = function lessThanOneHourAgo(date) {
  return moment(date).isAfter(moment().subtract(1, 'hours'));
};
