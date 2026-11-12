import { ITemplate, ITemplateSlide, IBlock } from '@/core/types';

export interface ConfirmState {
  open: boolean;
  kind: 'slide' | 'group' | 'template' | 'block';
  title: string;
  description: string;
  template?: ITemplate;
  slide?: ITemplateSlide | 'base';
  blockId?: string;
  block?: IBlock;
  migrationTargetId?: string;
  onConfirmOverride?: () => Promise<void>;
}

export const EMPTY_CONFIRM: ConfirmState = { open: false, kind: 'slide', title: '', description: '' };

