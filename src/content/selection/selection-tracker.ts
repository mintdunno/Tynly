import { findContentEditableHost } from '../input/contenteditable-adapter.ts';
import type { InputAdapterRegistry, ResolvedInputTarget } from '../input/input-adapter-registry.ts';

export interface ViewportAnchor {
  readonly bottom: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
}

export type SelectionContext =
  | {
      readonly anchor: ViewportAnchor;
      readonly kind: 'editable';
      readonly target: ResolvedInputTarget;
      readonly text: string;
    }
  | {
      readonly anchor: ViewportAnchor;
      readonly kind: 'page';
      readonly text: string;
    };

export interface SelectionTrackerOptions {
  readonly isIgnoredNode?: (node: Node) => boolean;
}

export type SelectionChangeHandler = (selection: SelectionContext | null) => void;

/**
 * Tracks the current user selection from events only. Any selection inside an
 * unsupported or sensitive editable is deliberately ignored rather than
 * reclassified as normal page text.
 */
export class SelectionTracker {
  private currentSelection: SelectionContext | null = null;
  private started = false;

  constructor(
    private readonly document: Document,
    private readonly adapters: InputAdapterRegistry,
    private readonly onChange: SelectionChangeHandler,
    private readonly options: SelectionTrackerOptions = {}
  ) {}

  get current(): SelectionContext | null {
    return this.currentSelection;
  }

  start(): void {
    if (this.started) {
      return;
    }
    this.started = true;
    this.document.addEventListener('selectionchange', this.handleSelectionChange, true);
    this.refresh();
  }

  stop(): void {
    if (!this.started) {
      return;
    }
    this.started = false;
    this.document.removeEventListener('selectionchange', this.handleSelectionChange, true);
    this.setCurrent(null);
  }

  refresh(): void {
    this.setCurrent(this.readSelection());
  }

  private readonly handleSelectionChange = (): void => {
    this.refresh();
  };

  private readSelection(): SelectionContext | null {
    const active = this.adapters.resolve(this.document.activeElement);
    if (active !== null) {
      const snapshot = active.adapter.capture(active.target);
      if (snapshot?.selection !== null && snapshot?.selection !== undefined) {
        const text = snapshot.text.slice(snapshot.selection.start, snapshot.selection.end);
        return text.trim().length > 0
          ? {
              anchor: toAnchor(active.target.getBoundingClientRect()),
              kind: 'editable',
              target: active,
              text
            }
          : null;
      }
    }

    const selection = this.document.getSelection();
    if (selection === null || selection.rangeCount !== 1 || selection.isCollapsed) {
      return null;
    }
    const range = selection.getRangeAt(0);
    if (
      this.shouldIgnore(range.startContainer) ||
      this.shouldIgnore(range.endContainer) ||
      isInsidePotentialEditable(range.startContainer) ||
      isInsidePotentialEditable(range.endContainer)
    ) {
      return null;
    }

    const text = selection.toString();
    if (text.trim().length === 0) {
      return null;
    }
    return { anchor: rangeAnchor(range), kind: 'page', text };
  }

  private shouldIgnore(node: Node): boolean {
    return this.options.isIgnoredNode?.(node) === true;
  }

  private setCurrent(next: SelectionContext | null): void {
    this.currentSelection = next;
    this.onChange(next);
  }
}

function isInsidePotentialEditable(node: Node): boolean {
  const element = nodeToElement(node);
  if (element === null) {
    return false;
  }
  if (element.closest('input, textarea') !== null) {
    return true;
  }
  return findContentEditableHost(element) !== null;
}

function rangeAnchor(range: Range): ViewportAnchor {
  const rect = range.getBoundingClientRect();
  if (rect.width > 0 || rect.height > 0) {
    return toAnchor(rect);
  }
  const rects = range.getClientRects();
  const fallback = rects.item(rects.length - 1);
  return toAnchor(fallback ?? rect);
}

function toAnchor(rect: Pick<DOMRect, 'bottom' | 'left' | 'right' | 'top'>): ViewportAnchor {
  return { bottom: rect.bottom, left: rect.left, right: rect.right, top: rect.top };
}

function nodeToElement(node: Node): Element | null {
  return node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
}
