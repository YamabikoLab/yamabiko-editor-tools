<?php

/**
 * Vite development and production asset resolution.
 *
 * @package YamabikoBlocks
 */

declare(strict_types=1);

namespace YamabikoLab\Blocks;

use JsonException;

final class AssetLoader
{
    private const DEV_DESCRIPTOR = 'dist/.vite/dev-server.json';
    private const PRODUCTION_METADATA = 'dist/asset-manifest.json';

    private string $plugin_root;
    private string $plugin_url;

    /** @var array<string, string> Normalized entry key to public script handle. */
    private array $editor_parent_entries;

    /** @param array<string, string> $editor_parent_entries Entry keys and public handles. */
    public function __construct(string $plugin_root, string $plugin_url, array $editor_parent_entries)
    {
        $this->plugin_root = rtrim($plugin_root, '/\\');
        $this->plugin_url = rtrim($plugin_url, '/') . '/';
        $this->editor_parent_entries = $editor_parent_entries;
    }

    public function register_hooks(): void
    {
        if (array() !== $this->editor_parent_entries) {
            add_action('enqueue_block_editor_assets', array($this, 'enqueue_editor_parent_assets'));
        }
    }

    public function enqueue_editor_parent_assets(): void
    {
        $development = $this->read_development_descriptor();

        if (null !== $development && $this->development_server_is_available($development['origin'])) {
            $this->enqueue_development_entries($development);
            return;
        }

        $this->enqueue_production_entries();
    }

    /** @return array{origin: string, client: string, entries: array<string, string>}|null */
    private function read_development_descriptor(): ?array
    {
        $descriptor = $this->read_json_file($this->plugin_root . '/' . self::DEV_DESCRIPTOR);

        if (
            null === $descriptor
            || ! isset($descriptor['origin'], $descriptor['client'], $descriptor['entries'])
            || ! is_string($descriptor['origin'])
            || ! is_string($descriptor['client'])
            || ! is_array($descriptor['entries'])
            || ! $this->is_loopback_origin($descriptor['origin'])
            || ! $this->is_development_path($descriptor['client'])
        ) {
            return null;
        }

        $entries = array();

        foreach ($descriptor['entries'] as $key => $path) {
            if (
                is_string($key)
                && is_string($path)
                && $this->is_entry_key($key)
                && $this->is_development_path($path)
            ) {
                $entries[$key] = $path;
            }
        }

        return array(
            'origin' => rtrim($descriptor['origin'], '/'),
            'client' => $descriptor['client'],
            'entries' => $entries,
        );
    }

    private function development_server_is_available(string $origin): bool
    {
        $response = wp_remote_get(
            $origin . '/@vite/client',
            array('redirection' => 0, 'timeout' => 0.5)
        );

        if (is_wp_error($response)) {
            return false;
        }

        $status = wp_remote_retrieve_response_code($response);
        return $status >= 200 && $status < 400;
    }

    /** @param array{origin: string, client: string, entries: array<string, string>} $development */
    private function enqueue_development_entries(array $development): void
    {
        if (! function_exists('wp_enqueue_script_module')) {
            return;
        }

        wp_enqueue_script_module(
            'yamabiko-blocks-vite-client',
            $development['origin'] . $development['client'],
            array(),
            null
        );

        foreach ($this->editor_parent_entries as $entry_key => $handle) {
            if (! isset($development['entries'][$entry_key])) {
                continue;
            }

            wp_enqueue_script_module(
                $handle,
                $development['origin'] . $development['entries'][$entry_key],
                array(),
                null
            );
        }
    }

    private function enqueue_production_entries(): void
    {
        $metadata = $this->read_json_file($this->plugin_root . '/' . self::PRODUCTION_METADATA);

        if (
            null === $metadata
            || 1 !== ($metadata['schemaVersion'] ?? null)
            || ! isset($metadata['entries'])
            || ! is_array($metadata['entries'])
        ) {
            return;
        }

        foreach ($this->editor_parent_entries as $entry_key => $expected_handle) {
            $entry = $metadata['entries'][$entry_key] ?? null;

            if (
                ! is_array($entry)
                || 'editor-parent' !== ($entry['surface'] ?? null)
                || $expected_handle !== ($entry['handle'] ?? null)
            ) {
                continue;
            }

            $this->enqueue_production_entry($entry);
        }
    }

    /** @param array<string, mixed> $entry */
    private function enqueue_production_entry(array $entry): void
    {
        if (
            ! isset($entry['handle'], $entry['file'], $entry['dependencies'], $entry['version'], $entry['css'])
            || ! is_string($entry['handle'])
            || ! $this->is_script_handle($entry['handle'])
            || ! is_string($entry['file'])
            || ! is_array($entry['dependencies'])
            || ! is_string($entry['version'])
            || 1 !== preg_match('/^[a-f0-9]{64}$/', $entry['version'])
            || ! is_array($entry['css'])
        ) {
            return;
        }

        $script_path = $this->resolve_dist_file($entry['file']);
        $dependencies = $this->validate_handles($entry['dependencies']);

        if (null === $script_path || count($dependencies) !== count($entry['dependencies'])) {
            return;
        }

        foreach ($entry['css'] as $index => $css_file) {
            if (! is_string($css_file) || null === $this->resolve_dist_file($css_file)) {
                return;
            }

            wp_enqueue_style(
                $entry['handle'] . '-style-' . ($index + 1),
                $this->plugin_url . 'dist/' . $css_file,
                array(),
                $entry['version']
            );
        }

        wp_enqueue_script(
            $entry['handle'],
            $this->plugin_url . 'dist/' . $entry['file'],
            $dependencies,
            $entry['version'],
            array('in_footer' => true)
        );
    }

    /**
     * @param array<mixed> $handles
     * @return list<string>
     */
    private function validate_handles(array $handles): array
    {
        $validated = array();

        foreach ($handles as $handle) {
            if (is_string($handle) && $this->is_script_handle($handle)) {
                $validated[] = $handle;
            }
        }

        return array_values(array_unique($validated));
    }

    private function resolve_dist_file(string $relative_path): ?string
    {
        if (
            '' === $relative_path
            || str_starts_with($relative_path, '/')
            || str_contains($relative_path, '..')
            || 1 !== preg_match('#^[A-Za-z0-9][A-Za-z0-9._/-]*$#', $relative_path)
        ) {
            return null;
        }

        $dist_path = realpath($this->plugin_root . '/dist');
        $file_path = realpath($this->plugin_root . '/dist/' . $relative_path);

        if (
            false === $dist_path
            || false === $file_path
            || ! is_file($file_path)
            || ! is_readable($file_path)
            || ! str_starts_with($file_path, $dist_path . DIRECTORY_SEPARATOR)
        ) {
            return null;
        }

        return $file_path;
    }

    private function is_loopback_origin(string $origin): bool
    {
        $parts = wp_parse_url($origin);

        if (
            false === $parts
            || ! isset($parts['scheme'], $parts['host'])
            || ! in_array($parts['scheme'], array('http', 'https'), true)
            || ! in_array($parts['host'], array('localhost', '127.0.0.1', '::1'), true)
            || isset($parts['user'])
            || isset($parts['pass'])
            || isset($parts['path'])
            || isset($parts['query'])
            || isset($parts['fragment'])
        ) {
            return false;
        }

        return ! isset($parts['port']) || ($parts['port'] >= 1 && $parts['port'] <= 65535);
    }

    private function is_development_path(string $path): bool
    {
        return str_starts_with($path, '/')
            && ! str_starts_with($path, '//')
            && ! str_contains($path, '..')
            && 1 === preg_match('#^/[A-Za-z0-9@._/-]+$#', $path);
    }

    private function is_entry_key(string $entry_key): bool
    {
        return 1 === preg_match('#^[a-z0-9][a-z0-9/-]*$#', $entry_key)
            && ! str_contains($entry_key, '//');
    }

    private function is_script_handle(string $handle): bool
    {
        return 1 === preg_match('/^[a-z0-9][a-z0-9._-]*$/', $handle);
    }

    /** @return array<string, mixed>|null */
    private function read_json_file(string $path): ?array
    {
        if (! is_file($path) || ! is_readable($path)) {
            return null;
        }

        $contents = file_get_contents($path);

        if (false === $contents) {
            return null;
        }

        try {
            $decoded = json_decode($contents, true, 512, JSON_THROW_ON_ERROR);
        } catch (JsonException) {
            return null;
        }

        return is_array($decoded) ? $decoded : null;
    }
}
