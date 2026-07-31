import {
  InspectorControls,
  RichText,
  useBlockProps,
} from "@wordpress/block-editor";
import type { BlockEditProps } from "@wordpress/blocks";
import { PanelBody, RadioControl } from "@wordpress/components";
import { __ } from "@wordpress/i18n";

import { normalizeTone, noticeTones, type NoticeTone } from "../tone";

type NoticeAttributes = Record<string, unknown> & {
  message: string;
  tone: NoticeTone;
};

export function Edit({
  attributes,
  setAttributes,
}: BlockEditProps<NoticeAttributes>) {
  const tone = normalizeTone(attributes.tone);
  const toneLabels: Record<NoticeTone, string> = {
    info: __("お知らせ", "yamabiko-blocks"),
    tip: __("ヒント", "yamabiko-blocks"),
    warning: __("注意", "yamabiko-blocks"),
  };
  const blockProps = useBlockProps({
    className: `yamabiko-blocks-notice is-tone-${tone}`,
  });

  return (
    <>
      <InspectorControls>
        <PanelBody title={__("表示設定", "yamabiko-blocks")}>
          <RadioControl
            label={__("表示種別", "yamabiko-blocks")}
            onChange={(value) => setAttributes({ tone: normalizeTone(value) })}
            options={noticeTones.map((value) => ({
              label: toneLabels[value],
              value,
            }))}
            selected={tone}
          />
        </PanelBody>
      </InspectorControls>
      <div {...blockProps}>
        <div className="yamabiko-blocks-notice__label">
          <strong>{toneLabels[tone]}</strong>
        </div>
        <RichText
          allowedFormats={["core/bold", "core/italic", "core/link"]}
          className="yamabiko-blocks-notice__message"
          onChange={(message: string) => setAttributes({ message })}
          placeholder={__("お知らせ本文を入力…", "yamabiko-blocks")}
          tagName="div"
          value={attributes.message}
        />
      </div>
    </>
  );
}
