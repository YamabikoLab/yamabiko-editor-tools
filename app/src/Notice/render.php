<?php

/**
 * Notice block dynamic rendering.
 *
 * @package YamabikoBlocks
 */

declare(strict_types=1);

$tone = isset($attributes['tone']) && is_string($attributes['tone'])
    ? $attributes['tone']
    : 'info';
$allowed_tones = array('info', 'tip', 'warning');

if (! in_array($tone, $allowed_tones, true)) {
    $tone = 'info';
}

$message = isset($attributes['message']) && is_string($attributes['message'])
    ? $attributes['message']
    : '';
$message = wp_kses(
    $message,
    array(
        'strong' => array(),
        'em' => array(),
        'br' => array(),
        'a' => array(
            'href' => true,
            'title' => true,
            'target' => true,
            'rel' => true,
            'data-type' => true,
            'data-id' => true,
        ),
    )
);

if ('' === trim(wp_strip_all_tags($message))) {
    return '';
}

$labels = array(
    'info' => __('お知らせ', 'yamabiko-blocks'),
    'tip' => __('ヒント', 'yamabiko-blocks'),
    'warning' => __('注意', 'yamabiko-blocks'),
);
$wrapper_attributes = get_block_wrapper_attributes(
    array('class' => 'yamabiko-blocks-notice is-tone-' . $tone)
);

printf(
    '<div %1$s><div class="yamabiko-blocks-notice__label"><strong>%2$s</strong></div><div class="yamabiko-blocks-notice__message">%3$s</div></div>',
    $wrapper_attributes,
    esc_html($labels[$tone]),
    $message
);
