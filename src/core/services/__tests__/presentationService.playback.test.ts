import { describe, it, expect, vi, beforeEach } from 'vitest';
import { presentationService } from '../presentationService';
import { usePresentationStore } from '@/features/presenter/store/presentationStore';
import { audioService } from '@/features/presenter/services/AudioService';
import { LiveSyncService } from '@/core/services/liveSyncService';
import type { IPresentationFile } from '@/core/types';

vi.mock('@/core/services/liveSyncService', () => ({
  LiveSyncService: {
    sendVideoCommand: vi.fn(),
    sendAudioCommand: vi.fn(),
    sendTimerCommand: vi.fn(),
    clear: vi.fn(),
  },
}));

describe('presentationService.toggleLiveMedia priority & targeting', () => {
  const videoPres = {
    id: 'p1',
    name: 'Video Pres',
    slides: [
      { id: 'vid-1', type: 'video', order: 0, blockId: 'b1', templateId: 't1', videoSettings: { mediaId: 'm1', volume: 1, speed: 1 } },
    ],
  } as unknown as IPresentationFile;

  beforeEach(() => {
    vi.clearAllMocks();
    audioService.targetScopeId = 'scope-1';
    vi.spyOn(audioService, 'getTrackProgress').mockReturnValue({
      currentTime: 5,
      duration: 60,
      isPlaying: true,
    });
    vi.spyOn(audioService, 'pauseTrack').mockImplementation(() => {});
    vi.spyOn(audioService, 'playTrack').mockImplementation(() => {});

    usePresentationStore.setState({
      liveSlideId: 'vid-1',
      activePresentation: videoPres,
      selectedPresentation: videoPres,
      nestedPresentationsCache: {},
    } as never);
  });

  it('prioritizes live video over background audio in auto mode', () => {
    const handled = presentationService.toggleLiveMedia('auto');
    expect(handled).toBe(true);
    expect(LiveSyncService.sendVideoCommand).toHaveBeenCalledWith('vid-1', 'toggle');
    expect(LiveSyncService.sendAudioCommand).not.toHaveBeenCalled();
  });

  it('supports explicit audio targeting when both video and audio are active', () => {
    const handled = presentationService.toggleLiveMedia('audio', 'pause');
    expect(handled).toBe(true);
    expect(LiveSyncService.sendAudioCommand).toHaveBeenCalledWith('scope-1', 'pause');
    expect(LiveSyncService.sendVideoCommand).not.toHaveBeenCalled();
  });

  it('supports pausing/resuming both video and audio with target="all"', () => {
    const handled = presentationService.toggleLiveMedia('all', 'pause');
    expect(handled).toBe(true);
    expect(LiveSyncService.sendVideoCommand).toHaveBeenCalledWith('vid-1', 'pause');
    expect(LiveSyncService.sendAudioCommand).toHaveBeenCalledWith('scope-1', 'pause');
  });
});
