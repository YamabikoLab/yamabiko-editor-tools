<?php
/**
 * お知らせブロックの動的レンダリング。
 *
 * @package YamabikoEditorTools
 */

declare( strict_types = 1 );

$tone = isset( $attributes['tone'] ) && is_string( $attributes['tone'] )
	? $attributes['tone']
	: 'info';
$allowed_tones = array( 'info', 'tip', 'warning' );

if ( ! in_array( $tone, $allowed_tones, true ) ) {
	$tone = 'info';
}

$message = isset( $attributes['message'] ) && is_string( $attributes['message'] )
	? $attributes['message']
	: '';
$message = wp_kses(
	$message,
	array(
		'strong' => array(),
		'em'     => array(),
		'br'     => array(),
		'a'      => array(
			'href'      => true,
			'title'     => true,
			'target'    => true,
			'rel'       => true,
			'data-type' => true,
			'data-id'   => true,
		),
	)
);

if ( '' === trim( wp_strip_all_tags( $message ) ) ) {
	return;
}

$labels = array(
	'info'    => __( 'お知らせ', 'yamabiko-editor-tools' ),
	'tip'     => __( 'ヒント', 'yamabiko-editor-tools' ),
	'warning' => __( '注意', 'yamabiko-editor-tools' ),
);
$wrapper_attributes = get_block_wrapper_attributes(
	array( 'class' => 'yamabiko-editor-tools-notice is-tone-' . $tone )
);
?>
<div <?php echo $wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>><div class="yamabiko-editor-tools-notice__label"><strong><?php echo esc_html( $labels[ $tone ] ); ?></strong></div><div class="yamabiko-editor-tools-notice__message"><?php echo $message; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></div></div>
