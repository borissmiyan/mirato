import React from 'react';
import { useTranslation } from 'react-i18next';
import { useAtom } from 'jotai';
import { themeAccentAtom, devModeAtom, isDevAuthenticatedAtom, clipSlideContentAtom } from '@/core/store/uiAtoms';
import { useHistoryStore } from '@/core/store/historyStore';
import { Globe, Palette, Clock, Code, Crop } from 'lucide-react';
import { useModalStore, ModalType } from '@/core/store/modalStore';
import { toast } from '@/core/utils/toast';
import { cn } from '@/core/utils/cn';
import { Card, DropdownSelector, Switch, SegmentedControl } from '@/shared/ui';
import { getSupportedLanguages } from '@/core/i18n';
import Flag from 'react-world-flags';

const GeneralSettings: React.FC = () => {
    const { t, i18n } = useTranslation();
    const openModal = useModalStore(state => state.openModal);
    const [themeAccent, setThemeAccent] = useAtom(themeAccentAtom);
    const [devMode, setDevMode] = useAtom(devModeAtom);
    const [isDevAuthenticated, setIsDevAuthenticated] = useAtom(isDevAuthenticatedAtom);
    const [clipContent, setClipContent] = useAtom(clipSlideContentAtom);

    const historyLimit = useHistoryStore(state => state.limit);
    const setHistoryLimit = useHistoryStore(state => state.setLimit);

    const languages = getSupportedLanguages();

    const themes = [
        { id: 'amber', label: t('theme_amber'), color: 'bg-amber-500', glow: 'shadow-amber-500/20' },
        { id: 'rose', label: t('theme_rose'), color: 'bg-rose-500', glow: 'shadow-rose-500/20' },
        { id: 'blue', label: t('theme_blue'), color: 'bg-blue-500', glow: 'shadow-blue-500/20' },
        { id: 'stone', label: t('theme_stone'), color: 'bg-stone-500', glow: 'shadow-stone-500/20' },
    ];

    const handleDevModeToggle = (nextVal: boolean) => {
        if (nextVal) {
            if (!isDevAuthenticated) {
                openModal(ModalType.PROMPT, {
                    title: t('enter_dev_password', 'Enter Developer Password'),
                    type: 'password',
                    onSelection: (pass: string | null) => {
                        if (pass === 'GLUE') {
                            setIsDevAuthenticated(true);
                            setDevMode(true);
                            toast.success(t('dev_mode_unlocked', 'Developer Mode Unlocked'), t('system_templates_accessible', 'System templates are now editable'));
                        } else if (pass !== null) {
                            toast.error(t('incorrect_password', 'Incorrect Password'), t('check_password_try_again', 'Please check the password and try again'));
                        }
                    }
                });
            } else {
                setDevMode(true);
            }
        } else {
            setDevMode(false);
        }
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-500">

            {/* Language Selection Card */}
            <Card padding="md" rounded="xl" className="col-span-1 md:col-span-2 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl rounded-full translate-x-10 -translate-y-10 group-hover:bg-accent/10 transition-colors pointer-events-none" />

                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center">
                        <Globe className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{t('language')}</h3>
                        <p className="text-xs text-stone-500 font-medium lowercase">{t('language_selection_desc')}</p>
                    </div>
                </div>

                <div className="max-w-xs relative z-10">
                    <DropdownSelector
                        size="md"
                        value={i18n.language.split('-')[0]}
                        options={languages.map(lang => ({
                            value: lang.code,
                            label: lang.label,
                            icon: <Flag code={lang.flag} className="w-6 h-4 rounded-xs object-cover" />
                        }))}
                        onChange={(val) => i18n.changeLanguage(val)}
                        renderSelected={(selected) => {
                            if (!selected) return null;
                            const lang = languages.find(l => l.code === selected.value);
                            return (
                                <div className="flex items-center gap-3">
                                    {selected.icon}
                                    <div className="flex flex-col items-start leading-none text-left">
                                        <span className="text-sm font-bold">{selected.label}</span>
                                        {lang && (
                                            <span className="text-[10px] mt-0.5 opacity-50 font-mono tracking-widest uppercase">{lang.native}</span>
                                        )}
                                    </div>
                                </div>
                            );
                        }}
                    />
                </div>
            </Card>

            {/* Theme / Appearance Card */}
            <Card padding="md" rounded="xl" className="col-span-1 md:col-span-2 relative overflow-hidden group">
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-accent/5 blur-3xl rounded-full -translate-x-20 translate-y-20 group-hover:bg-accent/10 transition-colors pointer-events-none" />

                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center">
                        <Palette className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{t('theme')}</h3>
                        <p className="text-xs text-stone-500 font-medium">{t('theme_description')}</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 relative z-10">
                    {themes.map((theme) => {
                        const isSelected = themeAccent === theme.id;
                        return (
                            <button
                                key={theme.id}
                                type="button"
                                onClick={() => setThemeAccent(theme.id)}
                                className={cn(
                                    "flex flex-col items-center gap-3 p-4 rounded-2xl transition-all duration-300 border cursor-pointer select-none apple-press will-change-transform",
                                    isSelected
                                        ? "bg-white/10 border-white/20 shadow-xl scale-[1.03]"
                                        : "bg-stone-950/50 border-white/5 hover:bg-stone-800/40"
                                )}
                            >
                                <div className={cn(
                                    "w-10 h-10 rounded-full flex items-center justify-center transition-transform duration-300",
                                    theme.color,
                                    isSelected ? "scale-110 shadow-[0_0_20px_currentColor]" : "opacity-60",
                                    theme.glow
                                )} />
                                <span className={cn(
                                    "text-xs font-bold uppercase tracking-widest",
                                    isSelected ? "text-white" : "text-stone-500"
                                )}>
                                    {theme.label}
                                </span>
                            </button>
                        );
                    })}
                </div>
            </Card>

            {/* History Settings Card */}
            <Card padding="md" rounded="xl" className="col-span-1 md:col-span-2 relative overflow-hidden group">
                <div className="flex items-center gap-3 mb-6 relative z-10">
                    <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center">
                        <Clock className="w-5 h-5 text-accent" />
                    </div>
                    <div>
                        <h3 className="text-lg font-bold text-white tracking-tight">{t('history_settings')}</h3>
                        <p className="text-xs text-stone-500 font-medium">{t('history_limit_desc')}</p>
                    </div>
                </div>

                <div className="relative z-10">
                    <SegmentedControl
                        value={historyLimit}
                        onChange={(val) => setHistoryLimit(Number(val))}
                        options={[
                            { value: 10, label: '10 шагов' },
                            { value: 30, label: '30 шагов' },
                            { value: 50, label: '50 шагов' },
                        ]}
                        size="sm"
                    />
                </div>
            </Card>

            {/* Developer Mode Card */}
            <Card padding="md" rounded="xl" className="col-span-1 md:col-span-2 relative overflow-hidden group">
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center">
                            <Code className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">{t('developer_mode', 'Developer Mode')}</h3>
                            <p className="text-xs text-stone-500 font-medium">{t('dev_mode_desc', 'Unlock system templates and advanced tools')}</p>
                        </div>
                    </div>

                    <Switch
                        checked={devMode}
                        onChange={handleDevModeToggle}
                        size="md"
                    />
                </div>
            </Card>

            {/* Clipping Content Card */}
            <Card padding="md" rounded="xl" className="col-span-1 md:col-span-2 relative overflow-hidden group">
                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-stone-800 rounded-xl flex items-center justify-center">
                            <Crop className="w-5 h-5 text-accent" />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white tracking-tight">{t('clip_content', 'Clip Content')}</h3>
                            <p className="text-xs text-stone-500 font-medium">{t('clip_content_desc', 'Hide elements that extend outside the slide boundaries')}</p>
                        </div>
                    </div>

                    <Switch
                        checked={clipContent}
                        onChange={(val) => setClipContent(val)}
                        size="md"
                    />
                </div>
            </Card>

        </div>
    );
};

export default GeneralSettings;
