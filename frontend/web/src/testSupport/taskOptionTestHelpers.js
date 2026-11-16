import { screen } from '@testing-library/react';

export async function fillTaskOption(user, label, value) {
  await user.selectOptions(screen.getByRole('combobox', { name: label, exact: true }), 'custom');
  const input = screen.getByLabelText(`其他${label}`);
  await user.clear(input);
  if (value) await user.type(input, value);
}
