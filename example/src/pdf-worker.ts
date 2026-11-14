// pdf.js parses documents in a web worker. With Vite, `?url` gives its URL; see the
// README's "pdf.js worker" section for other bundlers.
import workerSrc from "pdfjs-dist/build/pdf.worker.min.mjs?url";

export { workerSrc };
