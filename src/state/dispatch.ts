import type { ToolAction } from '../config/tools';
import { useConfig } from './useConfig';

export type DispatchResult = { ok: boolean; summary: string };

export function dispatchAction(action: ToolAction): DispatchResult {
  if (action.type === 'updateConfig') {
    useConfig.getState().applyPatch(action.patch);
    return { ok: true, summary: summarizePatch(action.patch) };
  }
  return { ok: false, summary: 'unknown action' };
}

function summarizePatch(patch: Record<string, unknown>): string {
  const parts: string[] = [];
  if ('feed' in patch) parts.push(`feed=${patch.feed}`);
  if ('storyLimit' in patch) parts.push(`limit=${patch.storyLimit}`);
  if ('palette' in patch && patch.palette) {
    const p = patch.palette as Record<string, unknown>;
    parts.push(`palette(${Object.keys(p).join(',')})`);
  }
  if ('slots' in patch && patch.slots) {
    const slots = patch.slots as Record<string, unknown>;
    for (const k of Object.keys(slots)) {
      parts.push(`slots.${k}=${slots[k] === null ? 'hidden' : 'expr'}`);
    }
  }
  if (Array.isArray(patch.hide)) parts.push(`hide=[${patch.hide.join(',')}]`);
  if (Array.isArray(patch.keepOnly)) parts.push(`keepOnly=[${patch.keepOnly.join(',')}]`);
  if ('style' in patch && patch.style) {
    const style = patch.style as Record<string, Record<string, unknown>>;
    for (const target of Object.keys(style)) {
      parts.push(`style.${target}(${Object.keys(style[target]).join(',')})`);
    }
  }
  return parts.length ? parts.join(', ') : 'no-op';
}
