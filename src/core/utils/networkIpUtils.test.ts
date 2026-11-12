import { describe, it, expect } from 'vitest';
import { selectBestLocalIp, getAvailableLocalIps, calculateBroadcastAddress, type NetworkInterfaceMap } from '@/core/utils/networkIpUtils';

describe('selectBestLocalIp', () => {
    it('returns 127.0.0.1 when no non-internal interfaces exist', () => {
        const mockNets: NetworkInterfaceMap = {
            lo0: [
                { address: '127.0.0.1', family: 'IPv4', internal: true }
            ]
        };
        expect(selectBestLocalIp(mockNets)).toBe('127.0.0.1');
    });

    it('prefers physical Wi-Fi/Ethernet interface over VPN/virtual interfaces', () => {
        const mockNets: NetworkInterfaceMap = {
            utun0: [
                { address: '10.8.0.2', family: 'IPv4', internal: false }
            ],
            docker0: [
                { address: '172.17.0.1', family: 'IPv4', internal: false }
            ],
            en0: [
                { address: '192.168.68.110', family: 'IPv4', internal: false }
            ]
        };
        expect(selectBestLocalIp(mockNets)).toBe('192.168.68.110');
    });

    it('ignores link-local 169.254.x.x addresses', () => {
        const mockNets: NetworkInterfaceMap = {
            en1: [
                { address: '169.254.12.34', family: 'IPv4', internal: false }
            ],
            en0: [
                { address: '10.0.1.50', family: 'IPv4', internal: false }
            ]
        };
        expect(selectBestLocalIp(mockNets)).toBe('10.0.1.50');
    });

    it('supports numeric family (family: 4) as used in some Node versions', () => {
        const mockNets: NetworkInterfaceMap = {
            'Wi-Fi': [
                { address: '192.168.1.42', family: 4 as any, internal: false }
            ]
        };
        expect(selectBestLocalIp(mockNets)).toBe('192.168.1.42');
    });

    it('handles empty or undefined network map gracefully', () => {
        expect(selectBestLocalIp({})).toBe('127.0.0.1');
    });
});

describe('getAvailableLocalIps', () => {
    it('returns ranked list of available non-virtual local IPv4 addresses', () => {
        const mockNets: NetworkInterfaceMap = {
            lo0: [{ address: '127.0.0.1', family: 'IPv4', internal: true }],
            utun0: [{ address: '10.8.0.2', family: 'IPv4', internal: false }],
            en0: [{ address: '192.168.68.110', family: 'IPv4', internal: false }],
            en1: [{ address: '10.0.0.5', family: 'IPv4', internal: false }]
        };
        const ips = getAvailableLocalIps(mockNets);
        expect(ips).toHaveLength(2);
        expect(ips[0]?.ip).toBe('192.168.68.110');
        expect(ips[1]?.ip).toBe('10.0.0.5');
    });

    it('returns 127.0.0.1 when no external interfaces exist', () => {
        const ips = getAvailableLocalIps({});
        expect(ips).toEqual([{ name: 'Localhost', ip: '127.0.0.1' }]);
    });
});

describe('calculateBroadcastAddress', () => {
    it('calculates broadcast address using netmask', () => {
        expect(calculateBroadcastAddress('192.168.1.50', '255.255.255.0')).toBe('192.168.1.255');
        expect(calculateBroadcastAddress('10.0.0.15', '255.255.0.0')).toBe('10.0.255.255');
    });

    it('falls back to /24 broadcast when netmask is omitted', () => {
        expect(calculateBroadcastAddress('192.168.68.100')).toBe('192.168.68.255');
    });

    it('returns global broadcast 255.255.255.255 for localhost or invalid ip', () => {
        expect(calculateBroadcastAddress('127.0.0.1')).toBe('255.255.255.255');
        expect(calculateBroadcastAddress('')).toBe('255.255.255.255');
    });
});
