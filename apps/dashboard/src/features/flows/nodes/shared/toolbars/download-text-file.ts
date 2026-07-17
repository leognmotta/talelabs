/** UTF-8 text download adapter used by generated LLM output actions. */

import { downloadFile } from './download-file'

/** Writes generated text to a UTF-8 browser download with the supplied filename. */
export function downloadTextFile(text: string, fileName: string) {
  downloadFile({
    content: text,
    fileName,
    mimeType: 'text/plain;charset=utf-8',
  })
}
