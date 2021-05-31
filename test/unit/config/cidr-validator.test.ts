import { isIp4InCidrs } from '../../../src/config/cidr-validator';

describe('cidr-validator', () => {
  test.each([
    ['192.168.1.5', ['10.10.0.0/16', '192.168.1.1/24'], true],
    ['10.10.1.5', ['10.10.0.0/16', '192.168.1.1/24'], true],
    ['122.168.1.5', ['10.10.0.0/16', '192.168.1.1/24'], false],
    ['some-hostname', ['10.10.0.0/16', '192.168.1.1/24'], false],
  ])('.isIp4InCidrs(%p, %p) === %p', (ip, cidrs, expected) => {
    expect(isIp4InCidrs(ip, cidrs)).toBe(expected);
  });
});
