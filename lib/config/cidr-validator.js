const newrelic = require('newrelic');

/**
 * The following IP/CIDR functions adapted from a blog post
 *
 * [MyBuilder.com]{@link https://tech.mybuilder.com/determining-if-an-ipv4-address-is-within-a-cidr-range-in-javascript/}
 */

/* eslint no-bitwise: ["error", { "allow": ["<<", ">>>", "~", "&"] }] */
/**
 * Convert an IP to an integer
 *
 * @param {string} ip - The IP to convert to an integer
 * @returns {number} Integer representation of the IP Address
 */
function ip4ToInt(ip) {
  return ip.split('.').reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;
}

/**
 * Wrapper function to keep the IP in scope while we test the CIDRs
 *
 * @param {string} ip - The IP Address in question
 * @returns {Function} A function to compare an IP to the CIDR
 */
function isIp4InCidr(ip) {
  const intIP = ip4ToInt(ip);
  /**
   * Take a CIDR and return if the IP Address in scope matches
   *
   * @param {string} cidr - The CIDR to compare with
   * @returns {boolean} if the IP is in the CIDR
   */
  return function (cidr) {
    // Trace this function to ensure it's not extraordinarily expensive
    return newrelic.startSegment('isIp4InCidr', true, () => {
      const [range, bits = 32] = cidr.split('/');
      const mask = ~(2 ** (32 - bits) - 1);
      return (intIP & mask) === (ip4ToInt(range) & mask);
    });
  };
}

/**
 * Determine if an IPv4 Address is within a list of CIDRs
 *
 * @param {string} ip - The IP Address in Question
 * @param {string[]} cidrs - The list of CIDRs applicable
 * @returns {boolean} if the IP is in any of the CIDRs
 * @example
 * > isIp4InCidrs('192.168.1.5', ['10.10.0.0/16', '192.168.1.1/24']);
 * true
 */
function isIp4InCidrs(ip, cidrs) {
  return cidrs.some(isIp4InCidr(ip));
}

module.exports = {
  isIp4InCidrs,
};
