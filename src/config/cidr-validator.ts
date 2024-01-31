/**
 * The following IP/CIDR functions are from a blog post
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
const ip4ToInt = (ip: string): number =>
	ip.split(".").reduce((int, oct) => (int << 8) + parseInt(oct, 10), 0) >>> 0;

/**
 * Wrapper function to keep the IP in scope while we test the CIDRs
 *
 * @param {string} ip - The IP Address in question
 * @returns {Function} A function to compare an IP to the CIDR
 */
const isIp4InCidr = (ip: string) => (cidr: string) => {
	const [range, bits = "32"] = cidr.split("/");
	const mask = ~(2 ** (32 - parseInt(bits)) - 1);
	return (ip4ToInt(ip) & mask) === (ip4ToInt(range) & mask);
};

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
export const isIp4InCidrs = (ip: string, cidrs: string[]): boolean =>
	cidrs.some(isIp4InCidr(ip));
