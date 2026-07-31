<?php

/**
 * Notice block registration.
 *
 * @package YamabikoBlocks
 */

declare(strict_types=1);

namespace YamabikoLab\Blocks\Notice;

final class Block
{
    public function register_hooks(): void
    {
        add_action('init', array($this, 'register'));
    }

    public function register(): void
    {
        register_block_type(__DIR__);
    }
}
