import "@vitejs/plugin-react/preamble";
import { registerBlockType, type BlockConfiguration } from "@wordpress/blocks";

import metadata from "../block.json";
import { Edit } from "../editor/Edit";

if (import.meta.env.DEV) {
  void import("../editor.css");
  void import("../style.css");
}

registerBlockType(metadata.name, {
  ...metadata,
  edit: Edit,
  save: () => null,
} as unknown as BlockConfiguration);
