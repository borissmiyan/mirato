import dgram from 'dgram';

export class UdpDiscoveryService {
    private udpServer: dgram.Socket | null = null;
    private udpBroadcastTimer: ReturnType<typeof setInterval> | null = null;

    constructor(
        private getPayload: () => { ip: string; port: number }
    ) {}

    public start(): void {
        try {
            this.stop();
            this.udpServer = dgram.createSocket({ type: 'udp4', reuseAddr: true });
            this.udpServer.on('error', (err) => console.warn('[RemoteServer] UDP error:', err.message));
            this.udpServer.on('message', (msg, rinfo) => {
                try {
                    if (msg.toString().includes('AIRDECK_DISCOVER')) {
                        const { ip, port } = this.getPayload();
                        const reply = JSON.stringify({ service: 'deck-ce-airdeck', ip, port });
                        this.udpServer?.send(reply, rinfo.port, rinfo.address);
                    }
                } catch { }
            });
            this.udpServer.bind(3212, '0.0.0.0', () => {
                try { this.udpServer?.setBroadcast(true); } catch { }
            });
            this.udpBroadcastTimer = setInterval(() => {
                if (!this.udpServer) return;
                try {
                    const { ip, port } = this.getPayload();
                    const beacon = JSON.stringify({ service: 'deck-ce-airdeck', ip, port });
                    this.udpServer.send(beacon, 3212, '255.255.255.255');
                } catch { }
            }, 3000);
        } catch (err) {
            console.warn('[RemoteServer] UDP init failed:', err);
        }
    }

    public stop(): void {
        if (this.udpBroadcastTimer) {
            clearInterval(this.udpBroadcastTimer);
            this.udpBroadcastTimer = null;
        }
        if (this.udpServer) {
            try { this.udpServer.close(); } catch { }
            this.udpServer = null;
        }
    }
}

