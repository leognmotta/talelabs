import { downloadFile } from './download-file'

export function downloadTextFile(text: string, fileName: string) {
  downloadFile({
    content: text,
    fileName,
    mimeType: 'text/plain;charset=utf-8',
  })
}
