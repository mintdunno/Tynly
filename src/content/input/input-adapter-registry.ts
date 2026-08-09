import { ContentEditableAdapter, findContentEditableHost } from './contenteditable-adapter.ts';
import { isSensitiveTarget } from './sensitive-target.ts';
import { InputElementAdapter, TextareaAdapter } from './text-control-adapter.ts';

import type { InputAdapter } from './types.ts';

export interface ResolvedInputTarget {
  readonly adapter: InputAdapter;
  readonly target: Element;
}

/**
 * Resolves a page element to one safe editor adapter. It is the content-side
 * safety boundary: sensitive fields are rejected before an adapter captures
 * text for a provider request.
 */
export class InputAdapterRegistry {
  private readonly adapters: readonly InputAdapter[];

  constructor(
    adapters: readonly InputAdapter[] = [
      new InputElementAdapter(),
      new TextareaAdapter(),
      new ContentEditableAdapter()
    ]
  ) {
    this.adapters = adapters;
  }

  resolve(target: EventTarget | null): ResolvedInputTarget | null {
    const editable = normalizeEditableTarget(target);
    if (editable === null || isSensitiveTarget(editable)) {
      return null;
    }

    const adapter = this.adapters.find((candidate) => candidate.canHandle(editable));
    return adapter === undefined ? null : { adapter, target: editable };
  }
}

function normalizeEditableTarget(target: EventTarget | null): Element | null {
  if (!(target instanceof Element)) {
    return null;
  }
  if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
    return target;
  }
  return findContentEditableHost(target);
}
