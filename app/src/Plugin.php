<?php

/**
 * Application composition for Yamabiko Blocks.
 *
 * @package YamabikoBlocks
 */

declare(strict_types=1);

namespace YamabikoLab\Blocks;

final class Plugin
{
    public static function init(): void
    {
        $asset_loader = new AssetLoader(
            dirname(__DIR__),
            plugin_dir_url(dirname(__DIR__) . '/yamabiko-blocks.php'),
            array(
                'notice/entries/notice-block' => 'yamabiko-blocks-notice-block-editor',
            )
        );
        $asset_loader->register_hooks();
    }
}
