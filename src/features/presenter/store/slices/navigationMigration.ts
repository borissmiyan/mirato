import { db } from '@/core/db';
import { IPresentationFile, IAudioScope, ISlide } from '@/core/types';

/**
 * Migrates legacy audio scopes embedded in presentation/slides to relational db.audioScopes table.
 */
export async function migratePresentationAudioScopes(id: string, pres: IPresentationFile): Promise<{ migratedSlides: ISlide[] }> {
    const allMigratableScopes: IAudioScope[] = [];

    if (pres.audioScopes && Array.isArray(pres.audioScopes)) {
        allMigratableScopes.push(...pres.audioScopes);
    }

    let slidesModified = false;
    const migratedSlides = pres.slides.map(slide => {
        const legacySlide = slide as ISlide & { audioScopes?: IAudioScope[] };
        if ('audioScopes' in slide && Array.isArray(legacySlide.audioScopes)) {
            allMigratableScopes.push(...legacySlide.audioScopes);
            slidesModified = true;
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { audioScopes, ...cleanSlide } = legacySlide;
            return cleanSlide as ISlide;
        }
        return slide;
    });

    if (allMigratableScopes.length > 0) {
        for (const scope of allMigratableScopes) {
            const existing = await db.audioScopes.get(scope.id);
            if (!existing) {
                await db.audioScopes.add({
                    ...scope,
                    presentationId: id
                });
            }
        }
    }

    if (pres.audioScopes || slidesModified) {
        await db.presentationFiles.update(id, {
            audioScopes: undefined,
            slides: migratedSlides
        });
        pres.audioScopes = undefined;
        pres.slides = migratedSlides;
    }

    return { migratedSlides };
}

