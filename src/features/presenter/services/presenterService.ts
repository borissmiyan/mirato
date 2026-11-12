import { IProjectorCommand, IProjectorState } from '@/core/types';
import { IpcService } from '@/core/services/ipcService';

/**
 * Service for handling presenter-specific logic and IPC communication.
 * Centralizes communication with the projector window.
 */
export const PresenterService = {
  /**
   * Sends a command to the projector window.
   */
  sendCommand: (command: IProjectorCommand) => {
    IpcService.send('projector-command', command.type, command.payload);
  },

  /**
   * Reports that the projector is ready.
   */
  reportProjectorReady: (ratio: number) => {
    IpcService.send('projector-ready', { ratio });
  },

  /**
   * Synchronizes state with the projector.
   */
  syncProjectorState: (state: IProjectorState) => {
    IpcService.send('projector-command', 'sync-state', state);
  },

  /**
   * Requests the projector to show a specific slide.
   */
  showSlide: (presentationId: string, slideId: string) => {
    PresenterService.sendCommand({
      type: 'show-slide',
      payload: { presentationId, slideId }
    });
  },

  /**
   * Requests the projector to pre-warm a preview slide.
   */
  showPreview: (presentationId: string, slideId: string) => {
    PresenterService.sendCommand({
      type: 'show-preview-slide',
      payload: { presentationId, slideId }
    });
  },

  /**
   * Sets a presentation override (blackout, etc).
   */
  setOverride: (type: 'blackout' | 'whiteout' | 'logo' | null) => {
    if (!type) {
      PresenterService.sendCommand({ type: 'clear-override', payload: {} });
    } else {
      PresenterService.sendCommand({ type: 'set-override', payload: { type } });
    }
  },

  /**
   * Subscribes to projector commands.
   * Returns an unsubscribe function.
   */
  subscribeToCommands: (callback: (command: string, payload: unknown) => void) => {
    return IpcService.on('projector-command', callback);
  }
};
