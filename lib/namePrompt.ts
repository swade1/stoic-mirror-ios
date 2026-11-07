// Imperative "ask for a name" dialog. React Native's Alert.prompt on iOS can
// only pre-fill text (no placeholder), so this drives a custom modal
// (components/NamePromptHost, mounted once in the root layout) instead.
export interface NamePromptOptions {
  title: string;
  message?: string;
  placeholder: string;
  confirmLabel: string;
  onSubmit: (value: string) => void;
}

type Listener = (options: NamePromptOptions) => void;
let listener: Listener | null = null;

export function registerNamePromptHost(fn: Listener | null) {
  listener = fn;
}

export function showNamePrompt(options: NamePromptOptions) {
  if (listener) listener(options);
  else options.onSubmit('');
}
