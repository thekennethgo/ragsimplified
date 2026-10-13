/**
 * The visitor's PDF files, kept only in this tab's memory (never in browser storage or on the
 * server), keyed by the id of the private text they were read into.
 */
const files = new Map<string, File>();

export const pdfFiles = {
  set(id: string, file: File) {
    files.set(id, file);
  },
  get(id: string): File | undefined {
    return files.get(id);
  },
  remove(id: string) {
    files.delete(id);
  },
};
