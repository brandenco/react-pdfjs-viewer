/** Saves `bytes` as a PDF file through a temporary download link. */
export function saveAsFile(bytes: Uint8Array, filename: string): void {
  // `Blob` needs ArrayBuffer-backed bytes; copy only if we were handed shared memory.
  const blobPart = isArrayBufferBacked(bytes) ? bytes : bytes.slice();
  const url = URL.createObjectURL(new Blob([blobPart], { type: "application/pdf" }));

  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.style.display = "none";
  document.body.append(link);
  link.click();
  link.remove();

  // Give the browser time to start the download before freeing the blob.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

function isArrayBufferBacked(bytes: Uint8Array): bytes is Uint8Array<ArrayBuffer> {
  return bytes.buffer instanceof ArrayBuffer;
}
