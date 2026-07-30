<?php

/**
 * Focused smoke check for missing asset output.
 *
 * @package YamabikoBlocks
 */

declare(strict_types=1);

use YamabikoLab\Blocks\AssetLoader;

$actions = array();
$enqueued = array();
$enqueued_details = array();
$remote_statuses = array();

function add_action(string $hook, callable $callback): void
{
    global $actions;
    $actions[$hook] = $callback;
}

function wp_enqueue_script_module(string $handle, string $url): void
{
    global $enqueued, $enqueued_details;
    $enqueued[] = 'module';
    $enqueued_details[] = array('type' => 'module', 'handle' => $handle, 'url' => $url);
}

function wp_enqueue_script(string $handle, string $url): void
{
    global $enqueued, $enqueued_details;
    $enqueued[] = 'script';
    $enqueued_details[] = array('type' => 'script', 'handle' => $handle, 'url' => $url);
}

function wp_enqueue_style(string $handle, string $url): void
{
    global $enqueued, $enqueued_details;
    $enqueued[] = 'style';
    $enqueued_details[] = array('type' => 'style', 'handle' => $handle, 'url' => $url);
}

function wp_parse_url(string $url)
{
    return parse_url($url);
}

function wp_remote_get(string $url): array
{
    global $remote_statuses;

    return array(
        'response' => array(
            'code' => $remote_statuses[$url] ?? 404,
        ),
    );
}

function is_wp_error($response): bool
{
    return false;
}

function wp_remote_retrieve_response_code(array $response): int
{
    return $response['response']['code'];
}

require_once dirname(__DIR__, 2) . '/src/AssetLoader.php';

function assert_no_assets_enqueued(string $message): void
{
    global $enqueued;

    if (array() !== $enqueued) {
        throw new RuntimeException($message);
    }
}

function reset_enqueued_assets(): void
{
    global $enqueued, $enqueued_details;

    $enqueued = array();
    $enqueued_details = array();
}

function assert_production_fallback_enqueued(string $message): void
{
    global $enqueued, $enqueued_details;

    $expected = array(
        array(
            'type' => 'style',
            'handle' => 'yamabiko-blocks-notice-block-editor-style-1',
            'url' => 'https://example.test/wp-content/plugins/yamabiko-blocks/dist/assets/notice.css',
        ),
        array(
            'type' => 'script',
            'handle' => 'yamabiko-blocks-notice-block-editor',
            'url' => 'https://example.test/wp-content/plugins/yamabiko-blocks/dist/assets/notice.js',
        ),
    );

    if (array('style', 'script') !== $enqueued || $expected !== $enqueued_details) {
        throw new RuntimeException($message);
    }
}

function create_loader(string $plugin_root): AssetLoader
{
    return new AssetLoader(
        $plugin_root,
        'https://example.test/wp-content/plugins/yamabiko-blocks/',
        array(
            'notice/entries/notice-block' => 'yamabiko-blocks-notice-block-editor',
        )
    );
}

function create_production_fixture(string $plugin_root): void
{
    mkdir($plugin_root . '/dist/assets', 0777, true);
    file_put_contents($plugin_root . '/dist/assets/notice.js', 'console.log("notice");');
    file_put_contents($plugin_root . '/dist/assets/notice.css', '.notice {}');
    file_put_contents(
        $plugin_root . '/dist/asset-manifest.json',
        json_encode(
            array(
                'schemaVersion' => 1,
                'entries' => array(
                    'notice/entries/notice-block' => array(
                        'handle' => 'yamabiko-blocks-notice-block-editor',
                        'surface' => 'editor-parent',
                        'file' => 'assets/notice.js',
                        'dependencies' => array(),
                        'version' => str_repeat('a', 64),
                        'css' => array('assets/notice.css'),
                    ),
                ),
            ),
            JSON_THROW_ON_ERROR
        )
    );
}

$missing_root = sys_get_temp_dir() . '/yamabiko-blocks-missing-assets-' . bin2hex(random_bytes(8));
$loader = create_loader($missing_root);
$loader->register_hooks();

if (! isset($actions['enqueue_block_editor_assets'])) {
    throw new RuntimeException('Editor-parent asset hook was not registered.');
}

$actions['enqueue_block_editor_assets']();
assert_no_assets_enqueued('Missing build output must not enqueue assets.');

reset_enqueued_assets();
$development_root = sys_get_temp_dir() . '/yamabiko-blocks-incomplete-development-' . bin2hex(random_bytes(8));
mkdir($development_root . '/dist/.vite', 0777, true);
create_production_fixture($development_root);
file_put_contents(
    $development_root . '/dist/.vite/dev-server.json',
    json_encode(
        array(
            'origin' => 'http://localhost:5173',
            'client' => '/@vite/client',
            'entries' => array(),
        ),
        JSON_THROW_ON_ERROR
    )
);
$remote_statuses = array('http://localhost:5173/@vite/client' => 200);
$loader = create_loader($development_root);
$loader->enqueue_editor_parent_assets();
assert_production_fallback_enqueued('Incomplete development metadata must enqueue production assets without the Vite client.');

reset_enqueued_assets();
$unavailable_entry_root = sys_get_temp_dir() . '/yamabiko-blocks-unavailable-development-entry-' . bin2hex(random_bytes(8));
mkdir($unavailable_entry_root . '/dist/.vite', 0777, true);
create_production_fixture($unavailable_entry_root);
file_put_contents(
    $unavailable_entry_root . '/dist/.vite/dev-server.json',
    json_encode(
        array(
            'origin' => 'http://localhost:5173',
            'client' => '/@vite/client',
            'entries' => array(
                'notice/entries/notice-block' => '/src/Notice/entries/notice-block.entry.ts',
            ),
        ),
        JSON_THROW_ON_ERROR
    )
);
$remote_statuses = array(
    'http://localhost:5173/@vite/client' => 200,
    'http://localhost:5173/src/Notice/entries/notice-block.entry.ts' => 404,
);
$loader = create_loader($unavailable_entry_root);
$loader->enqueue_editor_parent_assets();
assert_production_fallback_enqueued('Unavailable development entries must enqueue production assets without the Vite client.');

reset_enqueued_assets();
$redirected_client_root = sys_get_temp_dir() . '/yamabiko-blocks-redirected-development-client-' . bin2hex(random_bytes(8));
mkdir($redirected_client_root . '/dist/.vite', 0777, true);
create_production_fixture($redirected_client_root);
file_put_contents(
    $redirected_client_root . '/dist/.vite/dev-server.json',
    json_encode(
        array(
            'origin' => 'http://localhost:5173',
            'client' => '/@vite/client',
            'entries' => array(
                'notice/entries/notice-block' => '/src/Notice/entries/notice-block.entry.ts',
            ),
        ),
        JSON_THROW_ON_ERROR
    )
);
$remote_statuses = array('http://localhost:5173/@vite/client' => 302);
$loader = create_loader($redirected_client_root);
$loader->enqueue_editor_parent_assets();
assert_production_fallback_enqueued('Redirected development resources must enqueue production assets without the Vite client.');

reset_enqueued_assets();
$production_root = sys_get_temp_dir() . '/yamabiko-blocks-malformed-css-' . bin2hex(random_bytes(8));
mkdir($production_root . '/dist/assets', 0777, true);
file_put_contents($production_root . '/dist/assets/notice.js', 'console.log("notice");');
file_put_contents($production_root . '/dist/assets/notice.css', '.notice {}');
file_put_contents(
    $production_root . '/dist/asset-manifest.json',
    json_encode(
        array(
            'schemaVersion' => 1,
            'entries' => array(
                'notice/entries/notice-block' => array(
                    'handle' => 'yamabiko-blocks-notice-block-editor',
                    'surface' => 'editor-parent',
                    'file' => 'assets/notice.js',
                    'dependencies' => array(),
                    'version' => str_repeat('a', 64),
                    'css' => array('assets/notice.css', 'assets/missing.css'),
                ),
            ),
        ),
        JSON_THROW_ON_ERROR
    )
);
$loader = create_loader($production_root);
$loader->enqueue_editor_parent_assets();
assert_no_assets_enqueued('Malformed CSS metadata must not enqueue partial assets.');

echo "AssetLoader safe-failure smoke checks passed.\n";
