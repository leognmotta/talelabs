/** Keyboard shortcut labels and bindings for editor-owned graph commands. */

function usesAppleCommandKey() {
  if (typeof window === 'undefined')
    return false

  return /Mac|iPhone|iPad|iPod/.test(window.navigator.platform)
}

/** Returns platform-appropriate shortcut labels for canvas command hints. */
export function getFlowCanvasShortcutLabels() {
  const apple = usesAppleCommandKey()

  return {
    delete: apple ? '⌫' : 'Delete',
    duplicate: apple ? '⌘ D' : 'Ctrl D',
    redo: apple ? '⇧ ⌘ Z' : 'Ctrl Y',
    undo: apple ? '⌘ Z' : 'Ctrl Z',
  } as const
}
