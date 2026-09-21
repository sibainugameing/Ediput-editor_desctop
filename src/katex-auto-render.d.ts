declare module "katex/contrib/auto-render" {
  interface MathDelimiter {
    left: string;
    right: string;
    display: boolean;
  }

  interface AutoRenderOptions {
    delimiters?: MathDelimiter[];
    ignoredTags?: string[];
    ignoredClasses?: string[];
    errorCallback?: (error: Error, element: HTMLElement) => void;
    preProcess?: (math: string) => string;
    displayMode?: boolean;
    output?: "html" | "mathml" | "htmlAndMathml";
    throwOnError?: boolean;
    errorColor?: string;
    strict?: boolean | "warn" | "ignore" | "error";
    trust?: boolean;
    globalGroup?: boolean;
    maxSize?: number;
    maxExpand?: number;
  }

  export default function renderMathInElement(
    element: HTMLElement,
    options?: AutoRenderOptions,
  ): void;
}
