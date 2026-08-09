export { ContentEditableAdapter, findContentEditableHost } from './contenteditable-adapter.ts';
export { InputAdapterRegistry, type ResolvedInputTarget } from './input-adapter-registry.ts';
export { isSensitiveTarget } from './sensitive-target.ts';
export { InputElementAdapter, TextareaAdapter } from './text-control-adapter.ts';
export {
  MAX_EDITABLE_MARKUP_CHARACTERS,
  MAX_EDITABLE_SNAPSHOT_CHARACTERS,
  type InputAdapter,
  type InputReplacement,
  type InputReplacementFailureReason,
  type InputReplacementOptions,
  type InputReplacementResult,
  type InputSnapshot,
  type InputTextRange
} from './types.ts';
