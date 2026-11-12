import React from 'react';
import { useTranslation } from 'react-i18next';
import { X, Pencil, Trash2, FolderPlus } from 'lucide-react';
import { ITemplate, IBlock } from '@/core/types';
import DropdownSelector from '@/shared/ui/DropdownSelector';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

interface TemplatePickerOverlaysProps {
  isDev: boolean;
  isRu: boolean;
  allBlocks: IBlock[];
  allTemplates: ITemplate[];
  // Naming
  isNamingTemplate: boolean;
  setIsNamingTemplate: (v: boolean) => void;
  namingTargetTemplate: ITemplate | null;
  newName: string;
  setNewName: (v: string) => void;
  newNameRu: string;
  setNewNameRu: (v: string) => void;
  targetBlockId: string | undefined;
  setTargetBlockId: (v: string | undefined) => void;
  confirmSaveTemplate: () => void;
  // Edit Template
  editingTemplate: ITemplate | null;
  setEditingTemplate: (v: ITemplate | null) => void;
  editName: string;
  setEditName: (v: string) => void;
  editNameRu: string;
  setEditNameRu: (v: string) => void;
  editId: string;
  setEditId: (v: string) => void;
  editBackgroundColor: string;
  setEditBackgroundColor: (v: string) => void;
  editCategoryId: string | undefined;
  setEditCategoryId: (v: string | undefined) => void;
  handleUpdateTemplateProperties: () => void;
  // Edit Layout
  editingLayout: { template: ITemplate; slide: { name?: string; nameRu?: string; categoryId?: string } } | null;
  setEditingLayout: (v: null) => void;
  editParentTemplateId: string | undefined;
  setEditParentTemplateId: (v: string | undefined) => void;
  handleUpdateLayoutProperties: () => void;
  // Move Bunch
  movingBunch: { template: ITemplate; sourceBlockId: string } | null;
  setMovingBunch: (v: null) => void;
  handleMoveBunch: (targetBId: string) => void;
  // Block Manager
  showBlockManager: boolean;
  setShowBlockManager: (v: boolean) => void;
  editingBlock: IBlock | null;
  setEditingBlock: (v: IBlock | null) => void;
  isAddingBlock: boolean;
  setIsAddingBlock: (v: boolean) => void;
  blockFormName: string;
  setBlockFormName: (v: string) => void;
  blockFormNameRu: string;
  setBlockFormNameRu: (v: string) => void;
  blockFormColor: string;
  setBlockFormColor: (v: string) => void;
  blockFormIcon: string;
  setBlockFormIcon: (v: string) => void;
  openBlockForm: (block?: IBlock) => void;
  saveBlock: () => void;
  requestDeleteBlock: (block: IBlock) => void;
}

export const TemplatePickerOverlays: React.FC<TemplatePickerOverlaysProps> = (props) => {
  const { t } = useTranslation();

  return (
    <>
      {/* ── Naming Template/Layout Overlay ── */}
      {props.isNamingTemplate && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-md animate-apple-modal">
          <div className="bg-stone-900 border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              {props.namingTargetTemplate ? t('name_layout') : t('name_template')}
            </h3>
            <div className="space-y-3">
              <Input
                autoFocus
                size="sm"
                value={props.newName}
                onChange={(e) => props.setNewName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') props.confirmSaveTemplate();
                  if (e.key === 'Escape') props.setIsNamingTemplate(false);
                }}
                placeholder={`${t('common:name')}...`}
              />
              {props.isDev && (
                <Input
                  size="sm"
                  value={props.newNameRu}
                  onChange={(e) => props.setNewNameRu(e.target.value)}
                  placeholder={`${t('common:name')} (RU)...`}
                />
              )}
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 block">
                  {t('select_block_category')}
                </label>
                <DropdownSelector
                  value={props.targetBlockId || ''}
                  onChange={(val) => props.setTargetBlockId(val || undefined)}
                  options={[
                    { value: '', label: t('no_block') },
                    ...props.allBlocks.map(b => ({
                      value: b.id,
                      label: `${b.icon} ${props.isRu ? b.nameRu : b.name}`
                    }))
                  ]}
                  size="sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 justify-center"
                onClick={() => props.setIsNamingTemplate(false)}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1 justify-center"
                onClick={props.confirmSaveTemplate}
                disabled={!props.newName.trim()}
              >
                {t('save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Template Properties Overlay ── */}
      {props.editingTemplate && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-md animate-apple-modal">
          <div className="bg-stone-900 border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              {t('edit_properties')}
            </h3>
            <div className="space-y-4">
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 block">
                  {t('template_name')}
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    autoFocus
                    size="sm"
                    value={props.editName}
                    onChange={(e) => props.setEditName(e.target.value)}
                    placeholder={t('common:name')}
                  />
                  <Input
                    size="sm"
                    value={props.editNameRu}
                    onChange={(e) => props.setEditNameRu(e.target.value)}
                    placeholder={`${t('common:name')} (RU)`}
                  />
                </div>
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 block">
                  {t('template_id')}
                </label>
                <Input
                  size="sm"
                  value={props.editId}
                  onChange={(e) => props.setEditId(e.target.value)}
                  className="font-mono text-xs text-stone-400"
                  placeholder="template-id"
                />
              </div>
              <div className="flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 block">
                    {t('category')}
                  </label>
                  <DropdownSelector
                    value={props.editCategoryId || ''}
                    onChange={(val) => props.setEditCategoryId(val || undefined)}
                    options={[
                      { value: '', label: t('no_block') },
                      ...props.allBlocks.map(b => ({
                        value: b.id,
                        label: `${b.icon} ${props.isRu ? b.nameRu : b.name}`
                      }))
                    ]}
                    size="sm"
                  />
                </div>
                <div className="shrink-0">
                  <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 block">
                    {t('background')}
                  </label>
                  <div className="flex items-center gap-2 bg-black/40 border border-white/10 rounded-xl p-1.5 min-h-[40px]">
                    <input
                      type="color"
                      value={props.editBackgroundColor}
                      onChange={(e) => props.setEditBackgroundColor(e.target.value)}
                      className="w-7 h-7 rounded-xl border-0 bg-transparent cursor-pointer overflow-hidden p-0"
                    />
                    <span className="text-[10px] font-mono text-stone-400 pr-1">
                      {props.editBackgroundColor.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 justify-center"
                onClick={() => props.setEditingTemplate(null)}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1 justify-center"
                onClick={props.handleUpdateTemplateProperties}
              >
                {t('save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Layout Properties Overlay ── */}
      {props.editingLayout && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-md animate-apple-modal">
          <div className="bg-stone-900 border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4">
              {t('edit_layout')}
            </h3>
            <div className="space-y-3">
              <Input
                autoFocus
                size="sm"
                value={props.editName}
                onChange={(e) => props.setEditName(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') props.handleUpdateLayoutProperties(); }}
                placeholder={t('common:name')}
              />
              <Input
                size="sm"
                value={props.editNameRu}
                onChange={(e) => props.setEditNameRu(e.target.value)}
                placeholder={`${t('common:name')} (RU)`}
              />
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 block">
                  {t('select_block_category')}
                </label>
                <DropdownSelector
                  value={props.editCategoryId || ''}
                  onChange={(val) => props.setEditCategoryId(val || undefined)}
                  options={[
                    { value: '', label: t('no_block') },
                    ...props.allBlocks.map(b => ({
                      value: b.id,
                      label: `${b.icon} ${props.isRu ? b.nameRu : b.name}`
                    }))
                  ]}
                  size="sm"
                />
              </div>
              <div>
                <label className="text-[9px] font-bold uppercase tracking-wider text-stone-500 mb-1.5 block">
                  {t('move_layout_to_template')}
                </label>
                <DropdownSelector
                  value={props.editParentTemplateId || props.editingLayout.template.id}
                  onChange={(val) => props.setEditParentTemplateId(val)}
                  options={props.allTemplates.filter(tmpl => tmpl.id !== 'blank-dark').map(tmpl => ({
                    value: tmpl.id,
                    label: `${props.isRu ? tmpl.nameRu : tmpl.name}${tmpl.id === props.editingLayout?.template.id ? ' ●' : ''}`
                  }))}
                  size="sm"
                />
              </div>
            </div>
            <div className="flex gap-3 mt-6">
              <Button
                variant="secondary"
                size="sm"
                className="flex-1 justify-center"
                onClick={() => { props.setEditingLayout(null); props.setEditParentTemplateId(undefined); }}
              >
                {t('cancel')}
              </Button>
              <Button
                variant="primary"
                size="sm"
                className="flex-1 justify-center"
                onClick={props.handleUpdateLayoutProperties}
              >
                {t('save')}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Move Bunch Overlay ── */}
      {props.movingBunch && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-md animate-apple-modal">
          <div className="bg-stone-900 border border-white/10 rounded-3xl w-full max-w-sm p-6 shadow-2xl">
            <h3 className="text-sm font-black text-white uppercase tracking-wider mb-4 text-center">
              {t('move_to_block')}
            </h3>
            <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto no-scrollbar">
              {props.allBlocks.map(block => (
                <button
                  type="button"
                  key={block.id}
                  onClick={() => props.handleMoveBunch(block.id)}
                  className="px-3.5 py-3 rounded-2xl bg-white/5 hover:bg-accent/10 border border-white/5 hover:border-accent/20 transition-all text-left cursor-pointer apple-press"
                >
                  <span className="text-[10px] font-black uppercase text-stone-400 hover:text-accent tracking-wider">
                    {block.icon} {props.isRu ? block.nameRu : block.name}
                  </span>
                </button>
              ))}
            </div>
            <Button
              variant="secondary"
              size="sm"
              className="w-full mt-4 justify-center"
              onClick={() => props.setMovingBunch(null)}
            >
              {t('cancel')}
            </Button>
          </div>
        </div>
      )}

      {/* ── Block Manager Overlay ── */}
      {props.showBlockManager && (
        <div className="absolute inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-md animate-apple-modal">
          <div className="bg-stone-900 border border-white/10 rounded-3xl w-full max-w-md p-6 shadow-2xl max-h-[75vh] flex flex-col">
            <div className="flex items-center justify-between mb-4 shrink-0">
              <h3 className="text-sm font-black text-white uppercase tracking-wide">
                {t('manage_blocks')}
              </h3>
              <Button
                variant="ghost"
                size="xs"
                square
                onClick={() => {
                  props.setShowBlockManager(false);
                  props.setIsAddingBlock(false);
                  props.setEditingBlock(null);
                }}
                className="text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto no-scrollbar space-y-2 mb-4">
              {props.allBlocks.map(block => (
                <div key={block.id} className="flex items-center gap-3 px-3.5 py-2.5 bg-white/4 rounded-2xl border border-white/5 group hover:border-white/10 transition-colors">
                  <span className="text-base shrink-0">{block.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{props.isRu ? block.nameRu : block.name}</p>
                    {props.isDev && <p className="text-[9px] text-stone-500 font-medium">#{block.id}</p>}
                  </div>
                  <div className="w-4 h-4 rounded-full shrink-0 border border-white/10" style={{ backgroundColor: block.color }} />
                  <Button
                    variant="ghost"
                    size="xs"
                    square
                    onClick={() => props.openBlockForm(block)}
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-accent transition-all"
                    aria-label={t('edit_block')}
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="xs"
                    square
                    onClick={() => props.requestDeleteBlock(block)}
                    className="opacity-0 group-hover:opacity-100 text-stone-400 hover:text-red-400 transition-all"
                    aria-label={t('delete_block')}
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>

            {(props.isAddingBlock || props.editingBlock) ? (
              <div className="bg-black/30 rounded-2xl border border-white/5 p-4 space-y-3 shrink-0">
                <h4 className="text-[10px] font-black text-stone-400 uppercase tracking-wider">
                  {props.editingBlock ? t('edit_block') : t('add_block')}
                </h4>
                <div className="flex gap-2">
                  <Input
                    autoFocus
                    size="sm"
                    value={props.blockFormName}
                    onChange={(e) => props.setBlockFormName(e.target.value)}
                    placeholder={t('block_name')}
                    className="flex-1"
                  />
                  <Input
                    size="sm"
                    value={props.blockFormNameRu}
                    onChange={(e) => props.setBlockFormNameRu(e.target.value)}
                    placeholder={t('block_name_ru')}
                    className="flex-1"
                  />
                </div>
                <div className="flex gap-2">
                  <div className="w-24">
                    <label className="text-[8px] font-bold text-stone-500 uppercase mb-1 block">
                      {t('block_icon')}
                    </label>
                    <Input
                      size="sm"
                      value={props.blockFormIcon}
                      onChange={(e) => props.setBlockFormIcon(e.target.value)}
                      className="text-center"
                      maxLength={4}
                    />
                  </div>
                  <div className="flex-1">
                    <label className="text-[8px] font-bold text-stone-500 uppercase mb-1 block">
                      {t('block_color')}
                    </label>
                    <div className="flex gap-2 items-center">
                      <input
                        type="color"
                        value={props.blockFormColor}
                        onChange={(e) => props.setBlockFormColor(e.target.value)}
                        className="w-8 h-8 rounded-xl border border-white/10 cursor-pointer bg-transparent shrink-0"
                      />
                      <Input
                        size="sm"
                        value={props.blockFormColor}
                        onChange={(e) => props.setBlockFormColor(e.target.value)}
                        className="font-mono text-xs"
                      />
                    </div>
                  </div>
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="flex-1 justify-center"
                    onClick={() => { props.setIsAddingBlock(false); props.setEditingBlock(null); }}
                  >
                    {t('cancel')}
                  </Button>
                  <Button
                    variant="primary"
                    size="sm"
                    className="flex-1 justify-center"
                    onClick={props.saveBlock}
                    disabled={!props.blockFormName.trim()}
                  >
                    {t('save')}
                  </Button>
                </div>
              </div>
            ) : (
              <Button
                variant="secondary"
                size="md"
                onClick={() => props.openBlockForm()}
                className="w-full justify-center gap-2 border-dashed border-white/15"
              >
                <FolderPlus className="w-4 h-4 text-accent" />
                {t('add_block')}
              </Button>
            )}
          </div>
        </div>
      )}
    </>
  );
};
