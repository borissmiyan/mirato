import React from 'react';
import { useTranslation } from 'react-i18next';
import {
    Copy,
    ClipboardPaste,
    Group,
    Ungroup,
    Blend,
    ArrowUp,
    ChevronsUp,
    ArrowDown,
    ChevronsDown,
    Lock,
    Unlock,
    Eye,
    EyeOff,
    Trash2,
    FlipHorizontal,
    FlipVertical,
} from 'lucide-react';
import ContextMenu, { ContextMenuItem } from '@/shared/ui/ContextMenu';
import { ICanvasItem } from '@/core/types';

interface CanvasContextMenuProps {
    x: number;
    y: number;
    onClose: () => void;
    selectedIds: string[];
    canvasItems: ICanvasItem[];
    canPasteStyle: boolean;
    onDuplicate: () => void;
    onCopyStyle: () => void;
    onPasteStyle: () => void;
    onGroup: () => void;
    onUngroup: () => void;
    onToggleMask?: () => void;
    onBringForward: () => void;
    onBringToFront: () => void;
    onSendBackward: () => void;
    onSendToBack: () => void;
    onToggleLock: () => void;
    onToggleVisibility: () => void;
    onFlipH?: () => void;
    onFlipV?: () => void;
    onDelete: () => void;
}

export const CanvasContextMenu: React.FC<CanvasContextMenuProps> = React.memo(({
    x,
    y,
    onClose,
    selectedIds,
    canvasItems,
    canPasteStyle,
    onDuplicate,
    onCopyStyle,
    onPasteStyle,
    onGroup,
    onUngroup,
    onToggleMask,
    onBringForward,
    onBringToFront,
    onSendBackward,
    onSendToBack,
    onToggleLock,
    onToggleVisibility,
    onFlipH,
    onFlipV,
    onDelete,
}) => {
    const { t } = useTranslation();

    const selectedItems = canvasItems.filter(i => selectedIds.includes(i.id));
    const hasSelection = selectedItems.length > 0;
    const canGroup = selectedItems.length > 1;
    const canUngroup = selectedItems.some(i => !!i.groupId);
    const anyLocked = selectedItems.some(i => i.locked);
    const anyHidden = selectedItems.some(i => i.visible === false);

    return (
        <ContextMenu x={x} y={y} onClose={onClose}>
            {/* Duplicate */}
            <ContextMenuItem
                icon={<Copy className="w-4 h-4" />}
                label={t('duplicate', 'Дублировать')}
                shortcut="⌘D"
                disabled={!hasSelection}
                onClick={() => {
                    onDuplicate();
                    onClose();
                }}
            />

            {/* Copy Style */}
            <ContextMenuItem
                icon={<Copy className="w-4 h-4" />}
                label={t('copy_style', 'Скопировать стиль')}
                shortcut="⌥⌘C"
                disabled={!hasSelection}
                onClick={() => {
                    onCopyStyle();
                    onClose();
                }}
            />

            {/* Paste Style */}
            <ContextMenuItem
                icon={<ClipboardPaste className="w-4 h-4" />}
                label={t('paste_style', 'Вставить стиль')}
                shortcut="⌥⌘V"
                disabled={!hasSelection || !canPasteStyle}
                onClick={() => {
                    onPasteStyle();
                    onClose();
                }}
            />

            <div className="h-px bg-white/5 my-1 mx-2" />

            {/* Group */}
            <ContextMenuItem
                icon={<Group className="w-4 h-4" />}
                label={t('group_selection', 'Сгруппировать')}
                shortcut="⌘G"
                disabled={!canGroup}
                onClick={() => {
                    onGroup();
                    onClose();
                }}
            />

            {/* Ungroup */}
            <ContextMenuItem
                icon={<Ungroup className="w-4 h-4" />}
                label={t('ungroup_selection', 'Разгруппировать')}
                shortcut="⇧⌘G"
                disabled={!canUngroup}
                onClick={() => {
                    onUngroup();
                    onClose();
                }}
            />

            {/* Mask */}
            <ContextMenuItem
                icon={<Blend className="w-4 h-4" />}
                label={selectedItems.some(i => i.isMask) ? t('unmask', 'Отменить маску') : t('use_as_mask', 'Использовать как маску')}
                shortcut="^⌘M"
                disabled={!hasSelection}
                onClick={() => {
                    onToggleMask?.();
                    onClose();
                }}
            />

            <div className="h-px bg-white/5 my-1 mx-2" />

            {/* Bring Forward */}
            <ContextMenuItem
                icon={<ArrowUp className="w-4 h-4" />}
                label={t('bring_forward', 'Переместить вперед')}
                shortcut="⌘]"
                disabled={!hasSelection}
                onClick={() => {
                    onBringForward();
                    onClose();
                }}
            />

            {/* Bring to Front */}
            <ContextMenuItem
                icon={<ChevronsUp className="w-4 h-4" />}
                label={t('bring_to_front', 'На передний план')}
                shortcut="⇧⌘]"
                disabled={!hasSelection}
                onClick={() => {
                    onBringToFront();
                    onClose();
                }}
            />

            {/* Send Backward */}
            <ContextMenuItem
                icon={<ArrowDown className="w-4 h-4" />}
                label={t('send_backward', 'Переместить назад')}
                shortcut="⌘["
                disabled={!hasSelection}
                onClick={() => {
                    onSendBackward();
                    onClose();
                }}
            />

            {/* Send to Back */}
            <ContextMenuItem
                icon={<ChevronsDown className="w-4 h-4" />}
                label={t('send_to_back', 'На задний план')}
                shortcut="⇧⌘["
                disabled={!hasSelection}
                onClick={() => {
                    onSendToBack();
                    onClose();
                }}
            />

            <div className="h-px bg-white/5 my-1 mx-2" />

            {/* Lock / Unlock */}
            <ContextMenuItem
                icon={anyLocked ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
                label={anyLocked ? t('unlock', 'Разблокировать') : t('lock', 'Заблокировать')}
                shortcut="⇧⌘L"
                disabled={!hasSelection}
                onClick={() => {
                    onToggleLock();
                    onClose();
                }}
            />

            {/* Hide / Show */}
            <ContextMenuItem
                icon={anyHidden ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                label={anyHidden ? t('show', 'Показать') : t('hide', 'Скрыть')}
                shortcut="⇧⌘H"
                disabled={!hasSelection}
                onClick={() => {
                    onToggleVisibility();
                    onClose();
                }}
            />

            {/* Flip Horizontal & Vertical */}
            {onFlipH && (
                <ContextMenuItem
                    icon={<FlipHorizontal className="w-4 h-4" />}
                    label={t('flip_horizontal', 'Отразить по горизонтали')}
                    shortcut="⇧H"
                    disabled={!hasSelection}
                    onClick={() => {
                        onFlipH();
                        onClose();
                    }}
                />
            )}
            {onFlipV && (
                <ContextMenuItem
                    icon={<FlipVertical className="w-4 h-4" />}
                    label={t('flip_vertical', 'Отразить по вертикали')}
                    shortcut="⇧V"
                    disabled={!hasSelection}
                    onClick={() => {
                        onFlipV();
                        onClose();
                    }}
                />
            )}

            <div className="h-px bg-white/5 my-1 mx-2" />

            {/* Delete */}
            <ContextMenuItem
                icon={<Trash2 className="w-4 h-4" />}
                label={t('delete', 'Удалить')}
                shortcut="⌫"
                danger
                disabled={!hasSelection}
                onClick={() => {
                    onDelete();
                    onClose();
                }}
            />
        </ContextMenu>
    );
});

CanvasContextMenu.displayName = 'CanvasContextMenu';

