<?php
/**
 * お知らせブロックの動的レンダリング。
 *
 * @package YamabikoEditorTools
 */

declare( strict_types = 1 );

$yamabiko_editor_tools_tone          = isset( $attributes['tone'] ) && is_string( $attributes['tone'] )
	? $attributes['tone']
	: 'info';
$yamabiko_editor_tools_allowed_tones = array( 'info', 'tip', 'warning' );

if ( ! in_array( $yamabiko_editor_tools_tone, $yamabiko_editor_tools_allowed_tones, true ) ) {
	$yamabiko_editor_tools_tone = 'info';
}

$yamabiko_editor_tools_message = isset( $attributes['message'] ) && is_string( $attributes['message'] )
	? $attributes['message']
	: '';
$yamabiko_editor_tools_message = wp_kses(
	$yamabiko_editor_tools_message,
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

if ( '' === trim( wp_strip_all_tags( $yamabiko_editor_tools_message ) ) ) {
	return;
}

$yamabiko_editor_tools_labels             = array(
	'info'    => __( 'お知らせ', 'yamabiko-editor-tools' ),
	'tip'     => __( 'ヒント', 'yamabiko-editor-tools' ),
	'warning' => __( '注意', 'yamabiko-editor-tools' ),
);
$yamabiko_editor_tools_wrapper_attributes = get_block_wrapper_attributes(
	array( 'class' => 'yamabiko-editor-tools-notice is-tone-' . $yamabiko_editor_tools_tone )
);
?>
<div <?php echo $yamabiko_editor_tools_wrapper_attributes; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?>><div class="yamabiko-editor-tools-notice__label"><strong><?php echo esc_html( $yamabiko_editor_tools_labels[ $yamabiko_editor_tools_tone ] ); ?></strong></div><div class="yamabiko-editor-tools-notice__message"><?php echo $yamabiko_editor_tools_message; // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped ?></div></div>
