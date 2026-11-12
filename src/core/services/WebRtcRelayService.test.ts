import { describe, it, expect, vi, beforeEach } from 'vitest';
import { WebRtcRelayService } from './WebRtcRelayService';

describe('WebRtcRelayService', () => {
    let mockPeerConnection: any;

    beforeEach(() => {
        mockPeerConnection = {
            addTrack: vi.fn(),
            createOffer: vi.fn().mockResolvedValue({ type: 'offer', sdp: 'mock-sdp-offer' }),
            createAnswer: vi.fn().mockResolvedValue({ type: 'answer', sdp: 'mock-sdp-answer' }),
            setLocalDescription: vi.fn().mockResolvedValue(undefined),
            setRemoteDescription: vi.fn().mockResolvedValue(undefined),
            addIceCandidate: vi.fn().mockResolvedValue(undefined),
            close: vi.fn(),
            onicecandidate: null,
            ontrack: null,
            oniceconnectionstatechange: null,
        };

        // Mock global RTCPeerConnection using function constructor
        const MockRtc = vi.fn(function (this: any) {
            return mockPeerConnection;
        });
        (global as any).RTCPeerConnection = MockRtc;

        const MockRtcDesc = vi.fn(function (this: any, desc: any) {
            return desc;
        });
        (global as any).RTCSessionDescription = MockRtcDesc;

        const MockRtcCandidate = vi.fn(function (this: any, cand: any) {
            return cand;
        });
        (global as any).RTCIceCandidate = MockRtcCandidate;
    });

    it('creates peer connection with hermetic LAN-only iceServers config', () => {
        const service = new WebRtcRelayService();
        service.createPeerConnection();

        expect((global as any).RTCPeerConnection).toHaveBeenCalledWith({
            iceServers: []
        });
    });

    it('attaches stream tracks when initialized as sender', async () => {
        const service = new WebRtcRelayService();
        const mockTrack = { id: 'video-track' } as unknown as MediaStreamTrack;
        const mockStream = {
            getTracks: () => [mockTrack]
        } as unknown as MediaStream;

        const onSignal = vi.fn();
        const offer = await service.initSender(mockStream, onSignal);

        expect(mockPeerConnection.addTrack).toHaveBeenCalledWith(mockTrack, mockStream);
        expect(mockPeerConnection.createOffer).toHaveBeenCalled();
        expect(mockPeerConnection.setLocalDescription).toHaveBeenCalledWith(offer);
        expect(offer.type).toBe('offer');
    });

    it('handles remote answer signal in sender mode', async () => {
        const service = new WebRtcRelayService();
        service.createPeerConnection();

        await service.handleSignal({ type: 'answer', sdp: 'remote-answer-sdp' });
        expect(mockPeerConnection.setRemoteDescription).toHaveBeenCalledWith({
            type: 'answer',
            sdp: 'remote-answer-sdp'
        });
    });

    it('handles remote ice candidate signal', async () => {
        const service = new WebRtcRelayService();
        service.createPeerConnection();

        await service.handleSignal({ candidate: 'candidate:1 1 UDP 12345 192.168.1.5' });
        expect(mockPeerConnection.addIceCandidate).toHaveBeenCalled();
    });

    it('closes peer connection on cleanup', () => {
        const service = new WebRtcRelayService();
        service.createPeerConnection();
        service.cleanup();

        expect(mockPeerConnection.close).toHaveBeenCalledTimes(1);
    });
});
