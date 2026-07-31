import { registerBlockType, type BlockConfiguration } from "@wordpress/blocks";

import metadata from "../block.json";
import { Edit } from "../editor/Edit";

registerBlockType(metadata.name, {
  ...metadata,
  edit: Edit,
  save: () => null,
} as unknown as BlockConfiguration);
