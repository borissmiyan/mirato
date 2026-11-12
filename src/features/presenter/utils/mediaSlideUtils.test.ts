import { describe, it, expect } from 'vitest';
import { createSlideFromMediaItem, createBackgroundLayerFromMedia } from './mediaSlideUtils';
import { IMediaItem } from '@/core/types';

describe('mediaSlideUtils', () => {
  it('creates a normal image slide with image background override', () => {
    const item: IMediaItem = {
      id: 'img-1',
      name: 'nature.jpg',
      path: '/path/to/nature.jpg',
      type: 'image',
      createdAt: 1000,
    };

    const slide = createSlideFromMediaItem(item, 0);

    expect(slide.type).toBe('normal');
    expect(slide.order).toBe(0);
    expect(slide.notes).toBe('nature.jpg');
    if (slide.type === 'normal') {
      expect(slide.backgroundOverride).toBeDefined();
      expect(slide.backgroundOverride?.[0].type).toBe('image');
      expect(slide.backgroundOverride?.[0].image?.url).toBe('/path/to/nature.jpg');
      expect(slide.backgroundOverride?.[0].image?.id).toBe('img-1');
    }
  });

  it('creates a video slide with videoSettings and video background override', () => {
    const item: IMediaItem = {
      id: 'vid-1',
      name: 'clip.mp4',
      path: '/path/to/clip.mp4',
      type: 'video',
      createdAt: 1000,
    };

    const slide = createSlideFromMediaItem(item, 2);

    expect(slide.type).toBe('video');
    expect(slide.order).toBe(2);
    expect(slide.notes).toBe('clip.mp4');
    if (slide.type === 'video') {
      expect(slide.videoSettings).toBeDefined();
      expect(slide.videoSettings.mediaId).toBe('vid-1');
      expect(slide.backgroundOverride?.[0].type).toBe('video');
      expect(slide.backgroundOverride?.[0].video?.url).toBe('/path/to/clip.mp4');
    }
  });

  it('creates an audio slide with audio metadata', () => {
    const item: IMediaItem = {
      id: 'aud-1',
      name: 'song.mp3',
      path: '/path/to/song.mp3',
      type: 'audio',
      createdAt: 1000,
    };

    const slide = createSlideFromMediaItem(item, 1);

    expect(slide.type).toBe('normal');
    expect(slide.order).toBe(1);
    expect(slide.notes).toBe('song.mp3');
    if (slide.type === 'normal') {
      expect(slide.audio).toBeDefined();
      expect(slide.audio?.filename).toBe('song.mp3');
      expect(slide.audio?.path).toBe('/path/to/song.mp3');
    }
  });

  it('creates image and video background layers correctly', () => {
    const imgItem: IMediaItem = {
      id: 'img-1',
      name: 'bg.jpg',
      path: '/media/bg.jpg',
      type: 'image',
      createdAt: 1000,
    };
    const imgLayer = createBackgroundLayerFromMedia(imgItem);
    expect(imgLayer.type).toBe('image');
    expect(imgLayer.image?.url).toBe('/media/bg.jpg');
    expect(imgLayer.image?.isFromDb).toBe(true);

    const vidItem: IMediaItem = {
      id: 'vid-1',
      name: 'bg.mp4',
      path: '/media/bg.mp4',
      type: 'video',
      createdAt: 1000,
    };
    const vidLayer = createBackgroundLayerFromMedia(vidItem);
    expect(vidLayer.type).toBe('video');
    expect(vidLayer.video?.url).toBe('/media/bg.mp4');
    expect(vidLayer.video?.isLooping).toBe(true);
    expect(vidLayer.video?.isFromDb).toBe(true);
  });
});
