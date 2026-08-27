export function isCreateAdminSubmitDisabled(label: string): boolean {
  return label.trim().length === 0;
}

export function isCreateApplicationSubmitDisabled(input: {
  adminCount: number;
  applicationAdminId: string;
  label: string;
}): boolean {
  return (
    input.adminCount === 0 ||
    input.label.trim().length === 0 ||
    input.applicationAdminId.trim().length === 0
  );
}

export function isCreateTokenSubmitDisabled(input: {
  disabled: boolean;
  label: string;
  scopes: string[];
}): boolean {
  return input.disabled || input.label.trim().length === 0 || input.scopes.length === 0;
}

export function isRenameSubmitDisabled(currentLabel: string, draftLabel: string): boolean {
  const trimmed = draftLabel.trim();
  return trimmed.length === 0 || trimmed === currentLabel.trim();
}
