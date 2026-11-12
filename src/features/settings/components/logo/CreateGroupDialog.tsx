import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Button } from '@/shared/ui/Button';
import { Input } from '@/shared/ui/Input';

export interface CreateGroupDialogProps {
  onSubmit: (name: string) => void;
  onCancel: () => void;
}

export const CreateGroupDialog: React.FC<CreateGroupDialogProps> = ({ onSubmit, onCancel }) => {
  const { t } = useTranslation();
  const [name, setName] = useState('');

  return (
    <div className="flex items-center gap-3 p-4 bg-stone-900/60 rounded-2xl border border-accent/20 animate-in fade-in slide-in-from-top-2 duration-200">
      <Input
        autoFocus
        size="sm"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' && name.trim()) onSubmit(name.trim());
          if (e.key === 'Escape') onCancel();
        }}
        placeholder={t('group_name_placeholder', 'Collection name...')}
        className="flex-1"
      />
      <Button
        variant="primary"
        size="sm"
        onClick={() => name.trim() && onSubmit(name.trim())}
        disabled={!name.trim()}
      >
        {t('common:create', 'Create')}
      </Button>
      <Button
        variant="ghost"
        size="sm"
        onClick={onCancel}
        className="text-stone-400 hover:text-white"
      >
        {t('common:cancel', 'Cancel')}
      </Button>
    </div>
  );
};
