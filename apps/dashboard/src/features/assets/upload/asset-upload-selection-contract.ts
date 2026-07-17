/** File and relative-path contract shared by Asset selection and upload queues. */

/** One selected file plus its optional sanitized path inside a dropped directory. */
export interface AssetUploadSelection {
  /** Browser file to validate and enqueue. */
  file: File
  /** Slash-delimited directory path, or null for a top-level file. */
  relativePath: string | null
}
