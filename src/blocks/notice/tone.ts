export const noticeTones = [ 'info', 'tip', 'warning' ] as const;

export type NoticeTone = ( typeof noticeTones )[ number ];

export const normalizeTone = ( value: unknown ): NoticeTone =>
	typeof value === 'string' && noticeTones.includes( value as NoticeTone )
		? ( value as NoticeTone )
		: 'info';
