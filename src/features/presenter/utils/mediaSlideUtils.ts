import { IMediaItem, ISlide, IStyleLayer } from '@/core/types';

/**
 * Creates a presentation slide from a media pool item (image, video, or audio).
 * Configures appropriate slide type, video settings, and background layers.
 */
export function createSlideFromMediaItem(media: IMediaItem, order: number): ISlide {
  const layerId = crypto.randomUUID();
  const slideId = crypto.randomUUID();

  if (media.type === 'video') {
    const videoLayer: IStyleLayer = {
      id: layerId,
      type: 'video',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      video: {
        url: media.path || '',
        id: media.id,
        source: 'local',
        isMuted: false,
        isLooping: false,
        isFromDb: !!media.data,
      },
    };

    return {
      id: slideId,
      type: 'video',
      notes: media.name,
      order,
      blockId: 'default',
      templateId: 'blank-dark',
      videoSettings: {
        mediaId: media.id,
        strategy: 'auto',
        scaling: 'contain',
        speed: 1,
        volume: 1,
        loop: false,
        muted: false,
      },
      backgroundOverride: [videoLayer],
    };
  }

  if (media.type === 'audio') {
    const colorLayer: IStyleLayer = {
      id: layerId,
      type: 'color',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      color: '#000000',
    };

    return {
      id: slideId,
      type: 'normal',
      notes: media.name,
      order,
      blockId: 'default',
      templateId: 'blank-dark',
      content: { variables: {} },
      audio: {
        filename: media.name,
        path: media.path || '',
      },
      backgroundOverride: [colorLayer],
    };
  }

  // Image item (default)
  const imageLayer: IStyleLayer = {
    id: layerId,
    type: 'image',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    image: {
      url: media.path || '',
      id: media.id,
      source: 'local',
      isFromDb: !!media.data,
    },
  };

  return {
    id: slideId,
    type: 'normal',
    notes: media.name,
    order,
    blockId: 'default',
    templateId: 'blank-dark',
    content: { variables: {} },
    backgroundOverride: [imageLayer],
  };
}

/**
 * Creates an IStyleLayer representing this media item as a background layer.
 * Supported for images and videos.
 */
export function createBackgroundLayerFromMedia(media: IMediaItem): IStyleLayer {
  const layerId = crypto.randomUUID();
  const isFromDb = !!media.data || Boolean(media.id && !media.path?.startsWith('http'));

  if (media.type === 'video') {
    return {
      id: layerId,
      type: 'video',
      visible: true,
      opacity: 1,
      blendMode: 'normal',
      video: {
        url: media.path || media.id || '',
        id: media.id,
        source: 'local',
        isMuted: true,
        isLooping: true,
        isFromDb,
      },
    };
  }

  return {
    id: layerId,
    type: 'image',
    visible: true,
    opacity: 1,
    blendMode: 'normal',
    image: {
      url: media.path || media.id || '',
      id: media.id,
      source: 'local',
      isFromDb,
    },
  };
}
