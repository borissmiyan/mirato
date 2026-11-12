import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { db } from '@/core/db';
import { IBlock } from '@/core/types';
import { toast } from '@/core/utils/toast';
import { ConfirmState } from './types';

interface UseTemplatePickerBlockManagerParams {
  setConfirmState: React.Dispatch<React.SetStateAction<ConfirmState>>;
}

export function useTemplatePickerBlockManager({ setConfirmState }: UseTemplatePickerBlockManagerParams) {
  const { t } = useTranslation();

  const [showBlockManager, setShowBlockManager] = useState(false);
  const [editingBlock, setEditingBlock] = useState<IBlock | null>(null);
  const [isAddingBlock, setIsAddingBlock] = useState(false);
  const [blockFormName, setBlockFormName] = useState('');
  const [blockFormNameRu, setBlockFormNameRu] = useState('');
  const [blockFormColor, setBlockFormColor] = useState('#6366f1');
  const [blockFormIcon, setBlockFormIcon] = useState('📄');

  const handleOpenBlockManager = () => {
    setShowBlockManager(true);
    setEditingBlock(null);
    setIsAddingBlock(false);
  };

  const handleStartEditBlock = (block?: IBlock) => {
    if (block) {
      setEditingBlock(block);
      setBlockFormName(block.name);
      setBlockFormNameRu(block.nameRu || '');
      setBlockFormColor(block.color || '#6366f1');
      setBlockFormIcon(block.icon || '📄');
      setIsAddingBlock(false);
    } else {
      setEditingBlock(null);
      setBlockFormName('');
      setBlockFormNameRu('');
      setBlockFormColor('#6366f1');
      setBlockFormIcon('📄');
      setIsAddingBlock(true);
    }
  };

  const saveBlock = async () => {
    if (!blockFormName.trim()) return;
    if (editingBlock) {
      const updated: IBlock = {
        ...editingBlock,
        name: blockFormName,
        nameRu: blockFormNameRu || blockFormName,
        color: blockFormColor,
        icon: blockFormIcon,
      };
      await db.blocks.put(updated);
    } else {
      const newBlock: IBlock = {
        id: crypto.randomUUID(),
        name: blockFormName,
        nameRu: blockFormNameRu || blockFormName,
        color: blockFormColor,
        icon: blockFormIcon,
        description: '',
        defaultSlides: 1,
      };
      await db.blocks.add(newBlock);
    }
    setEditingBlock(null);
    setIsAddingBlock(false);
    toast.success(t('block_saved'));
  };

  const requestDeleteBlock = (block: IBlock) => {
    setConfirmState({
      open: true,
      kind: 'block',
      title: t('confirm_delete_block'),
      description: t('confirm_delete_block_desc'),
      block,
    });
  };

  return {
    showBlockManager,
    setShowBlockManager,
    editingBlock,
    setEditingBlock,
    isAddingBlock,
    setIsAddingBlock,
    blockFormName,
    setBlockFormName,
    blockFormNameRu,
    setBlockFormNameRu,
    blockFormColor,
    setBlockFormColor,
    blockFormIcon,
    setBlockFormIcon,
    handleOpenBlockManager,
    handleStartEditBlock,
    saveBlock,
    requestDeleteBlock,
  };
}

