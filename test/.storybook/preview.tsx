// The default look, imported the way an app would. (Its sources, so no :where() wrapping.)
import "react-pdfjs-viewer/ui.css";
import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    // Run axe on every story; any violation fails that story's test.
    a11y: { test: "error" },
    // The complete viewer first, so Storybook opens on PdfViewer › Default; then the
    // ways to build your own, from composed parts down to hooks.
    options: {
      storySort: { order: ["PdfViewer", "Composable", "Custom toolbar (hooks)"] },
    },
  },
  decorators: [
    (Story) => (
      // The viewer fills its container, so give every story a full-height one.
      <div style={{ height: "100vh", padding: 16, boxSizing: "border-box" }}>
        <Story />
      </div>
    ),
  ],
};

export default preview;
