import i18n from '@/core/i18n';
import { useModalStore, ModalType } from '@/core/store/modalStore';

const BULK_DELETE_CONFIRM_THRESHOLD = 5;

/**
 * Prompts a confirmation dialog before deleting slides if:
 * 1) Any of the targeted slides is currently LIVE on the projector, or
 * 2) 5 or more slides are being deleted at once.
 * Otherwise executes `onConfirm` immediately (recoverable via Cmd+Z undo).
 */
export function confirmSlideDeletionIfNeeded(
    slideIds: string[],
    liveSlideId: string | null | undefined,
    onConfirm: () => void | Promise<void>
): void {
    if (slideIds.length === 0) return;

    const includesLive = Boolean(liveSlideId && slideIds.includes(liveSlideId));
    const isBulk = slideIds.length >= BULK_DELETE_CONFIRM_THRESHOLD;

    if (!includesLive && !isBulk) {
        void onConfirm();
        return;
    }

    const t = i18n.t.bind(i18n);
    const title = includesLive
        ? t('confirm_delete_live_slide_title', 'Удалить слайд в эфире?')
        : t('confirm_delete_bulk_slides_title', 'Удалить выбранные слайды?');
    const message = includesLive
        ? (slideIds.length > 1
            ? t('confirm_delete_live_slides_msg', {
                count: slideIds.length,
                defaultValue: `Среди выбранных (${slideIds.length}) есть слайд, который сейчас отображается на проекторе (LIVE). Вы уверены, что хотите удалить?`,
            })
            : t('confirm_delete_live_slide_msg', 'Этот слайд сейчас отображается на проекторе (LIVE). Вы уверены, что хотите его удалить?'))
        : t('confirm_delete_bulk_slides_msg', {
            count: slideIds.length,
            defaultValue: `Вы собираетесь удалить ${slideIds.length} слайдов. Вы уверены?`,
        });

    useModalStore.getState().openModal(ModalType.CONFIRM, {
        title,
        message,
        variant: 'danger',
        confirmLabel: t('delete', 'Удалить'),
        onSelection: (confirmed: boolean) => {
            if (confirmed) {
                void onConfirm();
            }
        },
    });
}
