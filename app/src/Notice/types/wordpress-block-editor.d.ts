declare module "@wordpress/block-editor" {
  import type { ComponentType, ReactNode } from "react";

  export const InspectorControls: ComponentType<{ children?: ReactNode }>;

  export const RichText: ComponentType<{
    allowedFormats?: string[];
    className?: string;
    onChange?: (value: string) => void;
    placeholder?: string;
    tagName?: string;
    value?: string;
  }>;

  export const useBlockProps: (props: { className: string }) => {
    className: string;
  };
}
