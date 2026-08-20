<?php
require_once '/wordpress/wp-load.php';

$page_id      = 100;
$demo_version = '0.3.2';

if ( get_post( $page_id ) ) {
	wp_delete_post( $page_id, true );
}

$core_rows = [
	[ 1, '富士山', '3,776 m', '山梨県・静岡県' ],
	[ 2, '北岳', '3,193 m', '山梨県' ],
	[ 3, '奥穂高岳', '3,190 m', '長野県・岐阜県' ],
	[ 4, '間ノ岳', '3,190 m', '山梨県・静岡県' ],
	[ 5, '槍ヶ岳', '3,180 m', '長野県・岐阜県' ],
	[ 6, '赤石岳', '3,121 m', '長野県・静岡県' ],
	[ 7, '涸沢岳', '3,110 m', '長野県・岐阜県' ],
	[ 8, '北穂高岳', '3,106 m', '長野県・岐阜県' ],
	[ 9, '大喰岳', '3,101 m', '長野県・岐阜県' ],
	[ 10, '前穂高岳', '3,090 m', '長野県' ],
	[ 11, '中岳', '3,084 m', '長野県・岐阜県' ],
	[ 12, '荒川中岳', '3,084 m', '静岡県' ],
	[ 13, '御嶽山', '3,067 m', '長野県・岐阜県' ],
	[ 14, '塩見岳', '3,052 m', '長野県・静岡県' ],
	[ 15, '南岳', '3,033 m', '長野県・岐阜県' ],
	[ 16, '仙丈ヶ岳', '3,033 m', '山梨県・長野県' ],
	[ 17, '乗鞍岳', '3,026 m', '長野県・岐阜県' ],
	[ 18, '農鳥岳', '3,026 m', '山梨県・静岡県' ],
	[ 19, '立山（大汝山）', '3,015 m', '富山県' ],
	[ 20, '聖岳', '3,013 m', '長野県・静岡県' ],
	[ 21, '剱岳', '2,999 m', '富山県' ],
	[ 22, '水晶岳', '2,986 m', '富山県' ],
	[ 23, '甲斐駒ヶ岳', '2,967 m', '山梨県・長野県' ],
	[ 24, '木曽駒ヶ岳', '2,956 m', '長野県' ],
	[ 25, '白馬岳', '2,932 m', '長野県・富山県' ],
	[ 26, '薬師岳', '2,926 m', '富山県' ],
	[ 27, '鷲羽岳', '2,924 m', '長野県・富山県' ],
	[ 28, '大天井岳', '2,922 m', '長野県' ],
	[ 29, '西穂高岳', '2,909 m', '長野県・岐阜県' ],
	[ 30, '鹿島槍ヶ岳', '2,889 m', '長野県・富山県' ],
];

function yet_demo_build_core_table_rows( array $rows ) {
	$table_rows = '';

	foreach ( $rows as $row ) {
		[ $number, $mountain, $height, $location ] = $row;

		if ( 7 === $number ) {
			$table_rows .= sprintf(
				'<tr><td>%d</td><td>%s</td><td>%s</td><td rowspan="2">%s</td><td>縦結合（所在地）</td></tr>',
				$number,
				esc_html( $mountain ),
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		if ( 8 === $number ) {
			$table_rows .= sprintf(
				'<tr><td>%d</td><td>%s</td><td>%s</td><td>縦結合（所在地）</td></tr>',
				$number,
				esc_html( $mountain ),
				esc_html( $height )
			);
			continue;
		}

		if ( 14 === $number ) {
			$table_rows .= sprintf(
				'<tr><td>%d</td><td colspan="2"><strong>%s</strong> / %s</td><td>%s</td><td>横結合（山名＋標高）</td></tr>',
				$number,
				esc_html( $mountain ),
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		$table_rows .= sprintf(
			'<tr><td>%d</td><td>%s</td><td>%s</td><td>%s</td><td></td></tr>',
			$number,
			esc_html( $mountain ),
			esc_html( $height ),
			esc_html( $location )
		);
	}

	return $table_rows;
}

$core_table_rows = yet_demo_build_core_table_rows( $core_rows );
$core_table      =
	'<!-- wp:table {"align":"wide"} -->' .
	'<figure class="wp-block-table alignwide"><table class="has-fixed-layout">' .
	'<thead><tr><th scope="col">No.</th><th scope="col">山名</th><th scope="col">標高</th><th scope="col">主な所在地</th><th scope="col">備考</th></tr></thead>' .
	'<tbody>' . $core_table_rows . '</tbody>' .
	'</table><figcaption class="wp-element-caption">日本の山 30座 / WordPress Core Table デモ</figcaption></figure>' .
	'<!-- /wp:table -->';

$flexible_rows = [
	[ 1, '<strong>Mount Everest</strong>', '8,848.86 m', 'ネパール・中国' ],
	[ 2, '<em>K2</em>', '8,611 m', 'パキスタン・中国' ],
	[ 3, '<a href="https://en.wikipedia.org/wiki/Kangchenjunga">Kangchenjunga</a>', '8,586 m', 'ネパール・インド' ],
	[ 4, '<code>Lhotse</code>', '8,516 m', 'ネパール・中国' ],
	[ 5, '<s>Makalu</s>', '8,485 m', 'ネパール・中国' ],
	[ 6, 'Cho Oyu<br>チョ・オユー', '8,188 m', 'ネパール・中国' ],
	[ 7, 'Dhaulagiri I', '8,167 m', 'ネパール' ],
	[ 8, 'Manaslu', '8,163 m', 'ネパール' ],
	[ 9, 'Nanga Parbat', '8,126 m', 'パキスタン' ],
	[ 10, 'Annapurna I', '8,091 m', 'ネパール' ],
	[ 11, 'Gasherbrum I', '8,080 m', 'パキスタン・中国' ],
	[ 12, 'Broad Peak', '8,051 m', 'パキスタン・中国' ],
	[ 13, 'Gasherbrum II', '8,035 m', 'パキスタン・中国' ],
	[ 14, 'Shishapangma', '8,027 m', '中国' ],
	[ 15, 'Gyachung Kang', '7,952 m', 'ネパール・中国' ],
	[ 16, 'Annapurna II', '7,937 m', 'ネパール' ],
	[ 17, 'Gasherbrum IV', '7,932 m', 'パキスタン' ],
	[ 18, 'Himalchuli', '7,893 m', 'ネパール' ],
	[ 19, 'Distaghil Sar', '7,885 m', 'パキスタン' ],
	[ 20, 'Ngadi Chuli', '7,871 m', 'ネパール' ],
	[ 21, 'Nuptse', '7,861 m', 'ネパール' ],
	[ 22, 'Khunyang Chhish', '7,852 m', 'パキスタン' ],
	[ 23, 'Masherbrum', '7,821 m', 'パキスタン' ],
	[ 24, 'Nanda Devi', '7,816 m', 'インド' ],
	[ 25, 'Chomo Lonzo', '7,804 m', '中国' ],
	[ 26, 'Batura Sar', '7,795 m', 'パキスタン' ],
	[ 27, 'Rakaposhi', '7,788 m', 'パキスタン' ],
	[ 28, 'Namcha Barwa', '7,782 m', '中国' ],
	[ 29, 'Kanjut Sar', '7,760 m', 'パキスタン' ],
	[ 30, 'Kamet', '7,756 m', 'インド' ],
];

function yet_demo_build_flexible_table_rows( array $rows ) {
	$table_rows = '';

	foreach ( $rows as $row ) {
		[ $number, $mountain, $height, $location ] = $row;

		if ( 7 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td>%s</td><td>%s</td><td rowspan="2">%s</td><td>縦結合（所在地、7〜8行目）</td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		if ( 8 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td>%s</td><td>%s</td><td>縦結合（所在地、7〜8行目）</td></tr>',
				$number,
				$mountain,
				esc_html( $height )
			);
			continue;
		}

		if ( 9 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td class="demo-mountain-cell">%s</td><td>%s</td><td>%s</td><td></td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		if ( 10 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td style="font-weight:600;background-color:#f0f6fc">%s</td><td>%s</td><td>%s</td><td></td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		if ( 14 === $number ) {
			$table_rows .= sprintf(
				'<tr><th scope="row">%d</th><td colspan="2" class="demo-merged-cell"><strong>%s</strong> / %s</td><td>%s</td><td>横結合（山名＋標高）</td></tr>',
				$number,
				$mountain,
				esc_html( $height ),
				esc_html( $location )
			);
			continue;
		}

		$table_rows .= sprintf(
			'<tr><th scope="row">%d</th><td>%s</td><td>%s</td><td>%s</td><td></td></tr>',
			$number,
			$mountain,
			esc_html( $height ),
			esc_html( $location )
		);
	}

	return $table_rows;
}

$flexible_table_rows = yet_demo_build_flexible_table_rows( $flexible_rows );
$flexible_table      =
	'<!-- wp:flexible-table-block/table {"align":"wide"} -->' .
	'<figure class="wp-block-flexible-table-block-table alignwide">' .
	'<table class="has-fixed-layout">' .
	'<thead><tr><th scope="col" style="width:64px">No.</th><th scope="col">山名</th><th scope="col">標高</th><th scope="col">主な所在地</th><th scope="col">備考</th></tr></thead>' .
	'<tbody>' . $flexible_table_rows . '</tbody>' .
	'</table><figcaption>世界の山 30座 / Flexible Table Block デモ</figcaption>' .
	'</figure>' .
	'<!-- /wp:flexible-table-block/table -->';

$content = implode(
	'',
	[
		'<!-- wp:paragraph --><p>マウス・タッチ・キーボードで、WordPress Core Table と Flexible Table Block の行を並べ替えられます。まずは下の30秒チャレンジを試してみてください。</p><!-- /wp:paragraph -->',
		'<!-- wp:heading --><h2 class="wp-block-heading">30秒チャレンジ</h2><!-- /wp:heading -->',
		'<!-- wp:list {"ordered":true} --><ol class="wp-block-list"><li>通常の行を1つ動かす</li><li>Undo で元に戻す</li><li>7〜8行目の縦結合行を動かそうとして、制限されることを確認する</li></ol><!-- /wp:list -->',
		'<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator -->',
		'<!-- wp:heading --><h2 class="wp-block-heading">WordPress Core Table：日本の山30座</h2><!-- /wp:heading -->',
		'<!-- wp:paragraph --><p>基本の行並べ替えを試すエリアです。7〜8行目の所在地は縦結合、14行目の山名＋標高は横結合です。</p><!-- /wp:paragraph -->',
		$core_table,
		'<!-- wp:separator --><hr class="wp-block-separator has-alpha-channel-opacity"/><!-- /wp:separator -->',
		'<!-- wp:heading --><h2 class="wp-block-heading">Flexible Table Block：世界の山30座</h2><!-- /wp:heading -->',
		'<!-- wp:paragraph --><p>書式付きセルや結合セルなどを試せる実験的なエリアです。標高順の30座で、7〜8行目の所在地は縦結合、14行目の山名＋標高は横結合です。RichText、リンク、インラインコード、改行、scope、class、セルスタイルも含めています。</p><!-- /wp:paragraph -->',
		$flexible_table,
		'<!-- wp:paragraph --><p>不具合や気づいた点があれば、<a href="https://github.com/YamabikoLab/yamabiko-editor-tools/issues">GitHub Issues</a> からお知らせください。</p><!-- /wp:paragraph -->',
		sprintf(
			'<!-- wp:paragraph {"align":"right","fontSize":"small"} --><p class="has-text-align-right has-small-font-size">Yamabiko Editor Tools v%s</p><!-- /wp:paragraph -->',
			esc_html( $demo_version )
		),
	]
);

$result = wp_insert_post(
	[
		'import_id'    => $page_id,
		'post_type'    => 'page',
		'post_status'  => 'publish',
		'post_title'   => '行の並べ替えデモ：日本と世界の山',
		'post_name'    => 'table-reorder-demo',
		'post_content' => $content,
		'post_author'  => 1,
	],
	true
);

if ( is_wp_error( $result ) ) {
	throw new RuntimeException( $result->get_error_message() );
}

update_option( 'show_on_front', 'page' );
update_option( 'page_on_front', $page_id );

global $wpdb;

$user = get_user_by( 'login', 'admin' );

if ( $user ) {
	$meta_key    = $wpdb->get_blog_prefix() . 'persisted_preferences';
	$preferences = get_user_meta( $user->ID, $meta_key, true );

	if (
		is_array( $preferences ) &&
		isset( $preferences['yamabiko-editor-tools'] )
	) {
		unset(
			$preferences['yamabiko-editor-tools']['tableReorderKeyboardCoachmarkDismissed'],
			$preferences['yamabiko-editor-tools']['tableReorderTouchCoachmarkDismissed']
		);

		if ( empty( $preferences['yamabiko-editor-tools'] ) ) {
			unset( $preferences['yamabiko-editor-tools'] );
		}

		update_user_meta( $user->ID, $meta_key, $preferences );
	}
}