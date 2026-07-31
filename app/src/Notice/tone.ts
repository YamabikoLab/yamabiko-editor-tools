export const noticeTones = ["info", "tip", "warning"] as const;

export type NoticeTone = (typeof noticeTones)[number];

export const normalizeTone = (value: unknown): NoticeTone =>
  "string" === typeof value && noticeTones.includes(value as NoticeTone)
    ? (value as NoticeTone)
    : "info";
