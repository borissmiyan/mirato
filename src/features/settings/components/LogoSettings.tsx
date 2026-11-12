import React from 'react';
import {
  Image as ImageIcon, Plus, FolderOpen, Folder, Trash2,
  ChevronDown, ChevronRight, FolderPlus, Group, RefreshCw, AlertCircle
} from 'lucide-react';
import { cn } from '@/core/utils/cn';
import { PRELOADED_LOGOS } from '@/core/data/logoData';
import { IpcService } from '@/core/services/ipcService';
import { CreateGroupDialog } from './logo/CreateGroupDialog';
import { LogoCard } from './logo/LogoCard';
import { LogoGrid } from './logo/LogoGrid';
import { useLogoSettings } from './logo/useLogoSettings';
import { Button } from '@/shared/ui/Button';
import { EmptyState } from '@/shared/ui/EmptyState';
import type { ILogo, ILogoGroup } from '@/core/types';
import type { TFunction } from 'i18next';

const DefaultLogoItem: React.FC<{
  logo: ILogo;
  isActive: boolean;
  customGroups: ILogoGroup[];
  onSelect: (id: string) => void;
  onMove: (logoId: string, targetGroupId: string | null) => void;
}> = React.memo(({ logo, isActive, customGroups, onSelect, onMove }) => {
  const handleSelect = React.useCallback(() => onSelect(logo.id), [onSelect, logo.id]);
  return (
    <LogoCard
      logo={logo}
      isActive={isActive}
      onSelect={handleSelect}
      allGroups={customGroups}
      onMove={onMove}
    />
  );
});
DefaultLogoItem.displayName = 'DefaultLogoItem';

const LogoGroupItem: React.FC<{
  group: ILogoGroup;
  isCollapsed: boolean;
  isImporting: boolean;
  activeLogoId: string | null;
  customGroups: ILogoGroup[];
  toggleCollapse: (id: string) => void;
  handleSelectFile: (groupId: string) => void;
  handleRefreshFolder: (group: ILogoGroup) => void;
  handleImportFolder: (groupId: string) => void;
  removeLogoGroup: (groupId: string) => void;
  setActiveLogo: (id: string) => void;
  handleRemoveFromGroup: (groupId: string, logoId: string) => void;
  moveLogoToGroup: (logoId: string, targetGroupId: string | null) => void;
  t: TFunction;
}> = React.memo(({
  group,
  isCollapsed,
  isImporting,
  activeLogoId,
  customGroups,
  toggleCollapse,
  handleSelectFile,
  handleRefreshFolder,
  handleImportFolder,
  removeLogoGroup,
  setActiveLogo,
  handleRemoveFromGroup,
  moveLogoToGroup,
  t,
}) => {
  const onToggle = React.useCallback(() => toggleCollapse(group.id), [toggleCollapse, group.id]);
  const onSelect = React.useCallback(() => handleSelectFile(group.id), [handleSelectFile, group.id]);
  const onRefresh = React.useCallback(() => handleRefreshFolder(group), [handleRefreshFolder, group]);
  const onImport = React.useCallback(() => handleImportFolder(group.id), [handleImportFolder, group.id]);
  const onRemove = React.useCallback(() => removeLogoGroup(group.id), [removeLogoGroup, group.id]);
  const onRemoveLogo = React.useCallback((logoId: string) => handleRemoveFromGroup(group.id, logoId), [handleRemoveFromGroup, group.id]);

  return (
    <div className="bg-stone-900/40 border border-white/5 rounded-3xl p-6 space-y-5">
      <div className="flex items-center gap-2 px-2">
        <Button
          variant="ghost"
          size="xs"
          square
          onClick={onToggle}
          aria-label={isCollapsed ? 'Expand' : 'Collapse'}
        >
          {isCollapsed
            ? <ChevronRight className="w-4 h-4 text-stone-400" />
            : <ChevronDown className="w-4 h-4 text-stone-400" />
          }
        </Button>
        <Group className="w-4 h-4 text-accent" />
        <h3 className="text-xs font-bold text-stone-200 uppercase tracking-[0.15em] flex-1 min-w-0 truncate">
          {group.name}
        </h3>
        <span className="text-[10px] text-stone-500 font-mono shrink-0 mr-2">
          {t('common:items_count', { count: group.logos.length, defaultValue: '{{count}} items' })}
        </span>

        <div className="flex items-center gap-1 shrink-0">
          <Button
            variant="ghost"
            size="xs"
            square
            onClick={onSelect}
            aria-label="Add logo to group"
            title={t('add_logo', 'Add Logo')}
          >
            <Plus className="w-4 h-4" />
          </Button>

          {group.folderPath && (
            <Button
              variant="ghost"
              size="xs"
              square
              onClick={onRefresh}
              disabled={isImporting}
              aria-label="Refresh from folder"
              title={t('refresh', 'Refresh')}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isImporting && "animate-spin")} />
            </Button>
          )}

          <Button
            variant="ghost"
            size="xs"
            square
            onClick={onImport}
            aria-label="Import folder to group"
            title={t('import_folder', 'Import Folder')}
          >
            <FolderOpen className="w-3.5 h-3.5" />
          </Button>

          <Button
            variant="ghost"
            size="xs"
            square
            onClick={onRemove}
            className="text-stone-400 hover:text-red-400 hover:bg-red-500/10"
            aria-label="Delete group"
            title={t('delete_group', 'Delete Group')}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </Button>
        </div>
      </div>

      {!isCollapsed && (
        group.logos.length > 0 ? (
          <LogoGrid
            logos={group.logos}
            activeLogoId={activeLogoId}
            onSelect={setActiveLogo}
            onRemove={onRemoveLogo}
            allGroups={customGroups}
            onMove={moveLogoToGroup}
          />
        ) : (
          <EmptyState
            icon={Folder}
            title={t('empty_collection')}
            description={t('empty_collection_desc')}
            size="sm"
          />
        )
      )}
    </div>
  );
});
LogoGroupItem.displayName = 'LogoGroupItem';

const LogoSettings: React.FC = () => {
  const {
    t,
    settings,
    activeLogoId,
    customGroups,
    isImporting,
    showCreateGroup,
    collapsedGroups,
    importTargetGroupId,
    setShowCreateGroup,
    handleSelectFile,
    handleImportFolder,
    handleRefreshFolder,
    handleCreateGroup,
    toggleCollapse,
    handleRemoveFromGroup,
    removeCustomLogo,
    setActiveLogo,
    moveLogoToGroup,
    removeLogoGroup,
  } = useLogoSettings();

  const handleSelectFileDirect = React.useCallback(() => handleSelectFile(), [handleSelectFile]);
  const handleImportFolderDirect = React.useCallback(() => handleImportFolder(), [handleImportFolder]);
  const handleOpenCreateGroup = React.useCallback(() => setShowCreateGroup(true), [setShowCreateGroup]);
  const handleCloseCreateGroup = React.useCallback(() => setShowCreateGroup(false), [setShowCreateGroup]);

  return (
    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {!IpcService.isElectron() && (
        <div className="flex items-center gap-3 px-5 py-4 bg-red-500/10 border border-red-500/20 rounded-2xl text-red-400 text-sm">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{t('electron_required_warning')}</span>
        </div>
      )}

      {/* ─── Action Bar ──────────────────────────────────────────────── */}
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          onClick={handleSelectFileDirect}
          className="flex items-center gap-3.5 px-5 py-3.5 bg-stone-900/60 border border-white/5 hover:border-accent/40 hover:bg-stone-800/60 rounded-2xl transition-all group cursor-pointer apple-press"
        >
          <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <Plus className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-white tracking-tight">{t('add_logo')}</span>
            <span className="block text-[10px] text-stone-500 font-medium">{t('select_single_logo_desc')}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleImportFolderDirect}
          disabled={isImporting && importTargetGroupId === null}
          className="flex items-center gap-3.5 px-5 py-3.5 bg-stone-900/60 border border-white/5 hover:border-accent/40 hover:bg-stone-800/60 rounded-2xl transition-all group disabled:opacity-50 cursor-pointer apple-press"
        >
          <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <FolderOpen className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-white tracking-tight">
              {isImporting && importTargetGroupId === null ? t('importing') : t('import_folder')}
            </span>
            <span className="block text-[10px] text-stone-500 font-medium">{t('import_folder_desc')}</span>
          </div>
        </button>

        <button
          type="button"
          onClick={handleOpenCreateGroup}
          className="flex items-center gap-3.5 px-5 py-3.5 bg-stone-900/60 border border-white/5 hover:border-accent/40 hover:bg-stone-800/60 rounded-2xl transition-all group cursor-pointer apple-press"
        >
          <div className="p-2.5 bg-white/5 rounded-xl group-hover:bg-accent group-hover:text-accent-foreground transition-colors">
            <FolderPlus className="w-4 h-4" />
          </div>
          <div className="text-left">
            <span className="block text-xs font-bold text-white tracking-tight">{t('create_collection')}</span>
            <span className="block text-[10px] text-stone-500 font-medium">{t('create_collection_desc')}</span>
          </div>
        </button>
      </div>

      {/* ─── Create Group Inline ────────────────────────────────────── */}
      {showCreateGroup && (
        <CreateGroupDialog
          onSubmit={handleCreateGroup}
          onCancel={handleCloseCreateGroup}
        />
      )}

      {/* ─── Ungrouped Custom Logos ─────────────────────────────────── */}
      {settings.logo.customLogos.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center gap-2.5 px-2">
            <ImageIcon className="w-4 h-4 text-accent" />
            <h3 className="text-xs font-bold text-stone-300 uppercase tracking-[0.2em]">
              {t('ungrouped_logos')}
            </h3>
            <span className="text-[10px] text-stone-500 font-mono">({settings.logo.customLogos.length})</span>
          </div>
          <LogoGrid
            logos={settings.logo.customLogos}
            activeLogoId={activeLogoId}
            onSelect={setActiveLogo}
            onRemove={removeCustomLogo}
            allGroups={customGroups}
            onMove={moveLogoToGroup}
          />
        </section>
      )}

      {/* ─── Custom Groups ──────────────────────────────────────────── */}
      {customGroups.map((group) => (
        <LogoGroupItem
          key={group.id}
          group={group}
          isCollapsed={collapsedGroups.has(group.id)}
          isImporting={isImporting}
          activeLogoId={activeLogoId}
          customGroups={customGroups}
          toggleCollapse={toggleCollapse}
          handleSelectFile={handleSelectFile}
          handleRefreshFolder={handleRefreshFolder}
          handleImportFolder={handleImportFolder}
          removeLogoGroup={removeLogoGroup}
          setActiveLogo={setActiveLogo}
          handleRemoveFromGroup={handleRemoveFromGroup}
          moveLogoToGroup={moveLogoToGroup}
          t={t}
        />
      ))}

      {/* ─── Empty State ────────────────────────────────────────────── */}
      {settings.logo.customLogos.length === 0 && customGroups.length === 0 && (
        <EmptyState
          icon={ImageIcon}
          title={t('no_custom_logos_title')}
          description={t('no_custom_logos_hint')}
          size="md"
        />
      )}

      {/* ─── Preloaded Collections ──────────────────────────────────── */}
      {PRELOADED_LOGOS.length > 0 && (
        <section className="space-y-6 pt-4 border-t border-white/5">
          <div className="flex items-center gap-2.5 px-2">
            <Group className="w-4 h-4 text-stone-400" />
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-[0.2em]">
              {t('preloaded_logo_groups')}
            </h3>
          </div>

          {PRELOADED_LOGOS.map((group) => (
            <div key={group.id} className="space-y-3">
              <div className="px-2">
                <h4 className="text-sm font-bold text-white">
                  {group.id === 'group-default' ? t('logo_group_default') : group.name}
                </h4>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                {group.logos.map((logo) => (
                  <DefaultLogoItem
                    key={logo.id}
                    logo={logo}
                    isActive={activeLogoId === logo.id}
                    customGroups={customGroups}
                    onSelect={setActiveLogo}
                    onMove={moveLogoToGroup}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>
      )}
    </div>
  );
};

export default LogoSettings;
