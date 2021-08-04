const parseHost = require('../util/parse-host-from-url');

const subdomainRegexp = /^\w(?:[\w-]{0,61}\w)?$/;
const ghaeDomains = ['ghaekube.net', 'ghe.com'];

// TODO: validate ghae url based on certificates
function validateGhaeDomain(ghaeHost) {
  // ghaeHost = ghaeAccount.ghaekube.net or ghaeAccount.ghe.com
  let ghaeSubDomain = ghaeHost.split('.')[0];
  let ghaeDomain = ghaeHost.replace(`${ghaeSubDomain}.`, '');
  return ghaeDomains.includes(ghaeDomain) && subdomainRegexp.test(ghaeSubDomain);
}

module.exports = {
  validateGhaeDomain,
};
