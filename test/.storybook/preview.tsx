import type { Preview } from "@storybook/react-vite";

const preview: Preview = {
  parameters: {
    layout: "fullscreen",
    // Run axe on every story; any violation fails that story's test.
    a11y: { test: "error" },
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
