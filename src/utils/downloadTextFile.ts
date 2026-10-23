/** Hands text to the browser as a file download - it lands in the user's Downloads folder (or wherever the browser is set to save). */
export function downloadTextFile(fileName: string, content: string, mimeType = 'text/plain;charset=utf-8'): void {
  const url = URL.createObjectURL(new Blob([content], { type: mimeType }));
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
