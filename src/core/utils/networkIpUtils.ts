export interface NetworkInterfaceEntry {
    address: string;
    family: string | number;
    internal: boolean;
    netmask?: string;
    mac?: string;
    cidr?: string | null;
    scopeid?: number;
}

export type NetworkInterfaceMap = Record<string, NetworkInterfaceEntry[] | undefined>;

/**
 * Selects the optimal IPv4 address for remote control server from available network interfaces.
 * Prioritizes physical Wi-Fi and Ethernet adapters, filtering out VPN and container tunnels.
 */
export function selectBestLocalIp(interfaces: NetworkInterfaceMap): string {
    const candidates: Array<{ name: string; ip: string; score: number }> = [];

    for (const [name, netList] of Object.entries(interfaces)) {
        if (!netList) continue;

        const isVirtual = /^(vbox|vmnet|docker|utun|tun|tap|tailscale|wg|virbr|veth|dummy|lo)/i.test(name);
        const isPhysical = /^(en|eth|wlan|wi-fi|ethernet|wl)/i.test(name);

        for (const net of netList) {
            const isIpv4 = net.family === 'IPv4' || net.family === 4;
            if (!isIpv4 || net.internal) continue;
            if (net.address.startsWith('169.254.') || net.address === '0.0.0.0') continue;

            let score = 0;
            if (isPhysical) score += 10;
            if (!isVirtual) score += 5;
            if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) score += 3;

            candidates.push({ name, ip: net.address, score });
        }
    }

    if (candidates.length === 0) {
        return '127.0.0.1';
    }

    candidates.sort((a, b) => b.score - a.score);
    return candidates[0]?.ip || '127.0.0.1';
}

/**
 * Returns a list of all detected local IPv4 addresses sorted by priority.
 */
export function getAvailableLocalIps(interfaces: NetworkInterfaceMap): Array<{ name: string; ip: string }> {
    const candidates: Array<{ name: string; ip: string; score: number }> = [];

    for (const [name, netList] of Object.entries(interfaces)) {
        if (!netList) continue;

        const isVirtual = /^(vbox|vmnet|docker|utun|tun|tap|tailscale|wg|virbr|veth|dummy|lo)/i.test(name);
        if (isVirtual) continue;

        const isPhysical = /^(en|eth|wlan|wi-fi|ethernet|wl)/i.test(name);

        for (const net of netList) {
            const isIpv4 = net.family === 'IPv4' || net.family === 4;
            if (!isIpv4 || net.internal) continue;
            if (net.address.startsWith('169.254.') || net.address === '0.0.0.0') continue;

            let score = 0;
            if (isPhysical) score += 10;
            if (!isVirtual) score += 5;
            if (net.address.startsWith('192.168.') || net.address.startsWith('10.')) score += 3;

            candidates.push({ name, ip: net.address, score });
        }
    }

    if (candidates.length === 0) {
        return [{ name: 'Localhost', ip: '127.0.0.1' }];
    }

    // Sort by score descending and deduplicate by IP
    candidates.sort((a, b) => b.score - a.score);
    const seen = new Set<string>();
    const result: Array<{ name: string; ip: string }> = [];

    for (const item of candidates) {
        if (!seen.has(item.ip)) {
            seen.add(item.ip);
            result.push({ name: item.name, ip: item.ip });
        }
    }

    return result;
}

/**
 * Calculates IPv4 broadcast address from an IP address and optional subnet mask.
 * Defaults to 255.255.255.255 or /24 broadcast if mask is invalid.
 */
export function calculateBroadcastAddress(ip: string, netmask?: string): string {
    if (!ip || ip === '127.0.0.1') return '255.255.255.255';
    
    if (!netmask) {
        const parts = ip.split('.');
        if (parts.length === 4) {
            return `${parts[0]}.${parts[1]}.${parts[2]}.255`;
        }
        return '255.255.255.255';
    }

    try {
        const ipParts = ip.split('.').map(Number);
        const maskParts = netmask.split('.').map(Number);
        if (ipParts.length !== 4 || maskParts.length !== 4 || ipParts.some(isNaN) || maskParts.some(isNaN)) {
            return '255.255.255.255';
        }
        const broadcast = ipParts.map((part, i) => (part | (~maskParts[i] & 255)));
        return broadcast.join('.');
    } catch {
        return '255.255.255.255';
    }
}
