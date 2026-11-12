import { db } from '@/core/db';
import { IMediaItem, ISlide } from '@/core/types';

interface SlideMediaInspectable {
  backgroundLayer?: { mediaId?: string; id?: string; path?: string };
  videoSettings?: { mediaId?: string };
  layers?: Array<{
    image?: { id?: string; path?: string };
    video?: { id?: string; path?: string };
    audio?: { id?: string; path?: string };
  }>;
  timerActions?: Array<{ payload?: { mediaId?: string } }>;
  audioScope?: {
    tracks?: Array<{ mediaId?: string; id?: string; path?: string }>;
  };
}

interface BackgroundMediaInspectable {
  mediaId?: string;
  id?: string;
  path?: string;
}

/**
 * Service to identify and delete orphan (unused) media pool items.
 * An orphan item is one not referenced by any slide background, media layer,
 * video setting, or audio track in any saved presentation or template.
 */
export class MediaCleanerService {
  /**
   * Scans all presentations and templates to find media items that are not referenced anywhere.
   */
  static async scanOrphans(): Promise<{ orphans: IMediaItem[]; orphanBytes: number }> {
    const referencedIds = new Set<string>();
    const referencedPaths = new Set<string>();

    const collectFromSlide = (slide: ISlide) => {
      if (!slide) return;
      const s = slide as (ISlide & SlideMediaInspectable);

      // 1. Background layer
      const bg = s.backgroundLayer;
      if (bg) {
        if (bg.mediaId) referencedIds.add(bg.mediaId);
        if (bg.id) referencedIds.add(bg.id);
        if (bg.path) referencedPaths.add(bg.path);
      }

      // 2. Video settings
      const vs = s.videoSettings;
      if (vs?.mediaId) {
        referencedIds.add(vs.mediaId);
      }

      // 3. Canvas / Style layers
      const layers = s.layers;
      if (Array.isArray(layers)) {
        for (const layer of layers) {
          if (layer.image?.id) referencedIds.add(layer.image.id);
          if (layer.image?.path) referencedPaths.add(layer.image.path);
          if (layer.video?.id) referencedIds.add(layer.video.id);
          if (layer.video?.path) referencedPaths.add(layer.video.path);
          if (layer.audio?.id) referencedIds.add(layer.audio.id);
          if (layer.audio?.path) referencedPaths.add(layer.audio.path);
        }
      }

      // 4. Timer slide actions
      const actions = s.timerActions;
      if (Array.isArray(actions)) {
        for (const action of actions) {
          if (action.payload?.mediaId) referencedIds.add(action.payload.mediaId);
        }
      }

      // 5. Audio scope
      const audioScope = s.audioScope;
      if (audioScope?.tracks) {
        for (const track of audioScope.tracks) {
          if (track.mediaId) referencedIds.add(track.mediaId);
          if (track.id) referencedIds.add(track.id);
          if (track.path) referencedPaths.add(track.path);
        }
      }
    };

    try {
      // Collect from presentations
      const presFiles = await db.presentationFiles.toArray();
      for (const pres of presFiles) {
        if (Array.isArray(pres.slides)) {
          for (const slide of pres.slides) {
            collectFromSlide(slide as ISlide);
          }
        }
      }

      // Collect from templates
      const templates = await db.templates.toArray();
      for (const tpl of templates) {
        if (Array.isArray(tpl.background)) {
          for (const rawBg of (tpl.background as BackgroundMediaInspectable[])) {
            const bg = rawBg;
            if (bg.mediaId) referencedIds.add(bg.mediaId);
            if (bg.id) referencedIds.add(bg.id);
            if (bg.path) referencedPaths.add(bg.path);
          }
        }
        if (Array.isArray(tpl.templateSlides)) {
          for (const sub of tpl.templateSlides) {
            if (Array.isArray(sub.backgroundOverride)) {
              for (const rawBg of (sub.backgroundOverride as BackgroundMediaInspectable[])) {
                const bg = rawBg;
                if (bg.mediaId) referencedIds.add(bg.mediaId);
                if (bg.id) referencedIds.add(bg.id);
                if (bg.path) referencedPaths.add(bg.path);
              }
            }
          }
        }
      }

      // Collect from hymn themes
      const hymnThemes = await db.hymnThemes.toArray();
      for (const theme of hymnThemes) {
        if (Array.isArray(theme.background)) {
          for (const rawBg of (theme.background as BackgroundMediaInspectable[])) {
            if (rawBg.mediaId) referencedIds.add(rawBg.mediaId);
            if (rawBg.id) referencedIds.add(rawBg.id);
            if (rawBg.path) referencedPaths.add(rawBg.path);
          }
        }
      }

      // Collect from logos
      const logos = await db.logos.toArray();
      for (const logo of logos) {
        if (logo.id) referencedIds.add(logo.id);
      }

      // Collect from registered backgrounds
      const backgrounds = await db.backgrounds.toArray();
      for (const bg of backgrounds) {
        if (bg.id) referencedIds.add(bg.id);
      }
    } catch (err) {
      console.warn('[MediaCleanerService] Error scanning presentations for media refs:', err);
    }

    // Now find items in mediaPool that are unreferenced
    const allPoolItems = await db.mediaPool.toArray();
    const orphans: IMediaItem[] = [];
    let orphanBytes = 0;

    for (const item of allPoolItems) {
      const isIdReferenced = referencedIds.has(item.id);
      const isPathReferenced = item.path && referencedPaths.has(item.path);

      if (!isIdReferenced && !isPathReferenced) {
        orphans.push(item);
        if (item.fileSize) {
          orphanBytes += item.fileSize;
        } else if (item.data) {
          orphanBytes += item.data.size;
        }
      }
    }

    return { orphans, orphanBytes };
  }

  /**
   * Deletes orphan items by their IDs.
   */
  static async deleteOrphans(orphanIds: string[]): Promise<number> {
    if (!orphanIds || orphanIds.length === 0) return 0;
    await db.mediaPool.where('id').anyOf(orphanIds).delete();
    return orphanIds.length;
  }
}
