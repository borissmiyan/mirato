export interface WebRtcSignal {
    type?: string;
    sdp?: string;
    candidate?: unknown;
}

export class WebRtcRelayService {
    private pc: RTCPeerConnection | null = null;
    private onSignalCallback?: (signal: WebRtcSignal) => void;
    private onStreamCallback?: (stream: MediaStream) => void;

    /**
     * Initializes a peer connection using strictly local host candidates (offline-hermetic).
     */
    public createPeerConnection(): RTCPeerConnection {
        if (this.pc) {
            this.cleanup();
        }

        this.pc = new RTCPeerConnection({
            iceServers: [] // Hermetic LAN host candidates only, no internet or STUN/TURN needed
        });

        this.pc.onicecandidate = (event) => {
            if (event.candidate && this.onSignalCallback) {
                this.onSignalCallback({ candidate: event.candidate });
            }
        };

        this.pc.ontrack = (event) => {
            if (event.streams && event.streams[0] && this.onStreamCallback) {
                this.onStreamCallback(event.streams[0]);
            }
        };

        return this.pc;
    }

    /**
     * Prepares Transmitter (Speaker PC) by attaching the media stream tracks and generating the SDP offer.
     */
    public async initSender(
        stream: MediaStream, 
        onSignal: (signal: WebRtcSignal) => void
    ): Promise<RTCSessionDescriptionInit> {
        this.onSignalCallback = onSignal;
        const pc = this.createPeerConnection();

        // Add all audio/video tracks to the peer connection
        stream.getTracks().forEach((track) => {
            pc.addTrack(track, stream);
        });

        // Configure 1080p/4K quality and prevent downscaling
        const senders = pc.getSenders?.() || [];
        for (const sender of senders) {
            if (sender.track?.kind === 'video' && typeof sender.getParameters === 'function') {
                try {
                    const params = sender.getParameters();
                    if (!params.encodings || params.encodings.length === 0) {
                        params.encodings = [{}];
                    }
                    params.encodings[0].maxBitrate = 30_000_000;
                    params.encodings[0].networkPriority = 'high';
                    params.degradationPreference = 'maintain-resolution';
                    sender.setParameters(params).catch(() => {});
                } catch {}
            }
        }

        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);

        return offer;
    }

    /**
     * Prepares Receiver (Projector PC) to receive the stream and respond with an SDP answer.
     */
    public async initReceiver(
        offer: RTCSessionDescriptionInit,
        onStream: (stream: MediaStream) => void,
        onSignal: (signal: WebRtcSignal) => void
    ): Promise<RTCSessionDescriptionInit> {
        this.onStreamCallback = onStream;
        this.onSignalCallback = onSignal;
        const pc = this.createPeerConnection();

        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);

        return answer;
    }

    /**
     * Processes incoming signaling data (answer or ICE candidate).
     */
    public async handleSignal(signal: WebRtcSignal): Promise<void> {
        if (!this.pc) return;

        try {
            if (signal.type === 'answer' || signal.type === 'offer') {
                await this.pc.setRemoteDescription(new RTCSessionDescription(signal as RTCSessionDescriptionInit));
            } else if (signal.candidate) {
                await this.pc.addIceCandidate(new RTCIceCandidate(signal.candidate));
            }
        } catch (err) {
            console.error('[WebRtcRelayService] Error handling signal:', err);
        }
    }

    /**
     * Cleanly closes the peer connection and removes all listeners.
     */
    public cleanup(): void {
        if (this.pc) {
            try {
                this.pc.onicecandidate = null;
                this.pc.ontrack = null;
                this.pc.close();
            } catch (err) {
                console.error('[WebRtcRelayService] Error closing peer connection:', err);
            }
            this.pc = null;
        }
        this.onSignalCallback = undefined;
        this.onStreamCallback = undefined;
    }
}
