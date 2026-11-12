export interface IQuickActionCommand {
  id: string;
  title: string;
  shortcut?: string;
  category: string;
  action: () => void | Promise<void>;
}

export function filterQuickActions(
  commands: IQuickActionCommand[],
  query: string
): IQuickActionCommand[] {
  const trimmed = query.trim().toLowerCase();
  if (!trimmed) return commands;

  return commands.filter(
    (cmd) =>
      cmd.title.toLowerCase().includes(trimmed) ||
      cmd.category.toLowerCase().includes(trimmed) ||
      (cmd.shortcut && cmd.shortcut.toLowerCase().includes(trimmed))
  );
}

