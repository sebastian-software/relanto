import { translate } from "./translate";

export function t(strings: TemplateStringsArray, ...values: unknown[]): string {
  if (values.length === 0) {
    return translate(strings[0]);
  }

  let message = strings[0];
  const parameters: Record<string, unknown> = {};

  for (const [index, value] of values.entries()) {
    const key = `value${index}`;
    parameters[key] = value;
    message += `{${key}}${strings[index + 1]}`;
  }

  return translate(message, parameters);
}
