import React, { useEffect, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import { Monitor, Cpu, ScreenShare } from 'lucide-react';
import { usePresenterStore } from '@/features/presenter/store/presenterStore';
import { useShallow } from 'zustand/react/shallow';
import { IpcService } from '@/core/services/ipcService';
import { Card, Switch, Button, Badge } from '@/shared/ui';

interface IDisplayInfo {
    id: number;
    label: string;
    bounds: { x: number; y: number; width: number; height: number };
    size: { width: number; height: number };
    scaleFactor: number;
}

interface DisplayCardItemProps {
    display: IDisplayInfo;
    isPresenter: boolean;
    isPreview: boolean;
    isStage: boolean;
    disabled: boolean;
    onSetPresenter: (id: number) => void;
    onSetPreview: (id: number) => void;
    onSetStage: (id: number) => void;
}

const DisplayCardItem: React.FC<DisplayCardItemProps> = React.memo(({
    display,
    isPresenter,
    isPreview,
    isStage,
    disabled,
    onSetPresenter,
    onSetPreview,
    onSetStage
}) => {
    const { t } = useTranslation();
    const isMain = display.bounds.x === 0 && display.bounds.y === 0;
    const isAssigned = isPresenter || isPreview || isStage;

    const handlePresenter = useCallback(() => onSetPresenter(display.id), [onSetPresenter, display.id]);
    const handlePreview = useCallback(() => onSetPreview(display.id), [onSetPreview, display.id]);
    const handleStage = useCallback(() => onSetStage(display.id), [onSetStage, display.id]);

    return (
        <Card
            padding="md"
            rounded="xl"
            className={`relative overflow-hidden transition-all duration-300 ${
                isAssigned ? 'border-accent/30 bg-accent/5' : ''
            }`}
        >
            <div className="absolute -bottom-4 -right-4 w-24 h-24 bg-accent/5 blur-2xl rounded-full pointer-events-none" />

            <div className="flex items-start justify-between mb-4 relative z-10">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center shrink-0">
                        <Monitor className="w-5 h-5 text-accent" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-bold text-white truncate">
                            {display.label || `${t('display')} ${display.id}`}
                        </h4>
                        <p className="text-[10px] text-stone-500 font-medium">
                            {isMain ? t('display_card_main') : t('display_card_external')}
                        </p>
                    </div>
                </div>
                <Badge variant="secondary" size="xs" rounded="md">
                    {display.size.width}x{display.size.height}
                </Badge>
            </div>

            <div className="flex flex-col gap-2 relative z-10">
                <Button
                    size="xs"
                    variant={isPresenter ? "primary" : "secondary"}
                    disabled={disabled}
                    onClick={handlePresenter}
                    leftIcon={<ScreenShare className="w-3.5 h-3.5" />}
                    className="w-full"
                >
                    {t('presenter_display')}
                </Button>

                <Button
                    size="xs"
                    variant={isPreview ? "primary" : "secondary"}
                    disabled={disabled}
                    onClick={handlePreview}
                    leftIcon={<Monitor className="w-3.5 h-3.5" />}
                    className="w-full"
                >
                    {t('preview_display')}
                </Button>

                <Button
                    size="xs"
                    variant={isStage ? "primary" : "secondary"}
                    disabled={disabled}
                    onClick={handleStage}
                    leftIcon={<Monitor className="w-3.5 h-3.5" />}
                    className="w-full"
                >
                    {t('stage_display', 'Stage Display')}
                </Button>
            </div>
        </Card>
    );
});
DisplayCardItem.displayName = 'DisplayCardItem';

const DisplaySettings: React.FC = () => {
    const { t } = useTranslation();
    const { settings, updateDisplay } = usePresenterStore(useShallow(state => ({
        settings: state.settings,
        updateDisplay: state.updateDisplay
    })));
    const [displays, setDisplays] = useState<IDisplayInfo[]>([]);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        const fetchDisplays = async () => {
            if (IpcService.isElectron()) {
                try {
                    const data = await IpcService.invoke<IDisplayInfo[]>('get-displays');
                    setDisplays(data);

                    // If auto-defining, calculate current aspect ratio
                    if (settings.display.autoDefine && data.length > 0) {
                        const externalDisplay = data.find((d: IDisplayInfo) => d.bounds.x !== 0 || d.bounds.y !== 0);
                        const display = externalDisplay || data[0];
                        const ratio = display.size.width / display.size.height;
                        if (settings.display.aspectRatio !== ratio) {
                            updateDisplay({ aspectRatio: ratio });
                        }
                    }
                } catch (error) {
                    console.error('Failed to fetch displays:', error);
                } finally {
                    setIsLoading(false);
                }
            }
        };

        fetchDisplays();
    }, [settings.display.autoDefine, updateDisplay, settings.display.aspectRatio]);

    const toggleAutoDefine = (nextVal: boolean) => {
        updateDisplay({ autoDefine: nextVal });
    };

    const setPresenterDisplay = (id: number) => {
        if (settings.display.autoDefine) return;
        const currentId = settings.display.presenterDisplayId;
        const display = displays.find(d => d.id === id);
        const ratio = display ? display.size.width / display.size.height : 16 / 9;

        updateDisplay({
            presenterDisplayId: currentId === id ? undefined : id,
            aspectRatio: currentId === id ? 16 / 9 : ratio
        });
    };

    const setPreviewDisplay = (id: number) => {
        if (settings.display.autoDefine) return;
        const currentId = settings.display.previewDisplayId;
        updateDisplay({ previewDisplayId: currentId === id ? undefined : id });
    };

    const setStageDisplay = (id: number) => {
        if (settings.display.autoDefine) return;
        const currentId = settings.display.stageDisplayId;
        updateDisplay({ stageDisplayId: currentId === id ? undefined : id });
    };

    return (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
            {/* Auto Detection Toggle */}
            <Card padding="md" rounded="xl" className="relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full translate-x-10 -translate-y-10 pointer-events-none" />

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center">
                            <Cpu className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">{t('auto_define_displays')}</h3>
                            <p className="text-xs text-stone-500 font-medium">{t('auto_define_desc')}</p>
                        </div>
                    </div>

                    <Switch
                        checked={settings.display.autoDefine}
                        onChange={toggleAutoDefine}
                        size="md"
                    />
                </div>
            </Card>

            {/* Display List */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {isLoading ? (
                    Array.from({ length: 2 }).map((_, i) => (
                        <div key={i} className="h-48 bg-stone-900/40 border border-white/5 rounded-2xl animate-pulse" />
                    ))
                ) : (
                    displays.map((display) => (
                        <DisplayCardItem
                            key={display.id}
                            display={display}
                            isPresenter={settings.display.presenterDisplayId === display.id}
                            isPreview={settings.display.previewDisplayId === display.id}
                            isStage={settings.display.stageDisplayId === display.id}
                            disabled={settings.display.autoDefine}
                            onSetPresenter={setPresenterDisplay}
                            onSetPreview={setPreviewDisplay}
                            onSetStage={setStageDisplay}
                        />
                    ))
                )}
            </div>

            {settings.display.autoDefine && (
                <div className="p-4 bg-accent/5 border border-accent/15 rounded-xl animate-in zoom-in-95 duration-300">
                    <p className="text-xs text-accent/90 font-medium leading-relaxed italic text-center">
                        {t('auto_define_active_notice', 'Automatic detection is active. The secondary monitor will be used for presentation by default.')}
                    </p>
                </div>
            )}
        </div>
    );
};

export default DisplaySettings;
