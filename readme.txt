=== Yamabiko Editor Tools ===
Tags: block editor, gutenberg, table
Requires at least: 6.8
Tested up to: 7.0
Requires PHP: 8.1
Stable tag: 0.3.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

Editor tools for intuitive content structure editing in WordPress.

== Description ==

Yamabiko Editor Tools improves the Gutenberg editing experience for site creators.

The current focus is Table Reorder, which lets you reorder body rows in supported table blocks while preserving the block's content structure.

Features include:

* Drag-and-drop row reordering with a dedicated handle.
* Touch interaction for row reordering.
* Support for iframe and non-iframe editors.
* Protection against invalid moves across vertically merged cells (`rowspan`).
* Synchronization of the reordered table back to Gutenberg block attributes.

This plugin is under active development. Behavior and specifications may change in future releases.

Source code and development documentation are available on GitHub:
https://github.com/YamabikoLab/yamabiko-editor-tools

To install dependencies and build a release ZIP from source:

`npm ci`
`npm run plugin-zip`

The generated archive is `yamabiko-editor-tools.zip`.

== Installation ==

1. Download `yamabiko-editor-tools.zip` from the GitHub Releases page.
2. In WordPress, go to Plugins > Add New Plugin > Upload Plugin.
3. Upload the ZIP file and install it.
4. Activate Yamabiko Editor Tools.

== Changelog ==

= 0.3.0 =

* Added: Added Table Reorder support for Flexible Table Block.
* Changed: Consolidated Core Table and Flexible Table Block-specific differences behind a thin block support boundary.
* Changed: Integrated Flexible Table Block `rowSpan` handling into the existing merged-cell movement constraints.
* Changed: Removed the Core Table-specific selector dependency from the temporary horizontal-scroll adjustment used by touch reorder mode.

= 0.2.0 =

* Changed: Refined the internal Table Reorder design by clarifying responsibilities around operation state, commit handling, controller lifecycle, UI behavior, and runtime loading.
* Changed: Avoid running Table Reorder-specific hooks for unsupported blocks.
* Changed: Removed unused compatibility APIs, arguments, calculations, and controller-specific test fixtures.
* Fixed: Prevented row-reorder handles from overlapping content in a narrow first column on mobile by expanding only when needed and allowing horizontal scrolling temporarily.

= 0.1.0 =

* Initial release of Yamabiko Editor Tools.
* Add Table Reorder for reordering Core Table body rows in the block editor.
