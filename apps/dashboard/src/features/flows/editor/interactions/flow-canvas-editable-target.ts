/** Excludes form controls and content-editable targets from canvas keyboard commands. */
export function isEditableCanvasTarget(target: EventTarget | null) {
  return target instanceof Element
    && Boolean(target.closest('input, textarea, select, [contenteditable="true"]'))
}
