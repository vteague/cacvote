import 'normalize.css';
import { createGlobalStyle, css } from 'styled-components';
import { VX_DEFAULT_FONT_FAMILY_DECLARATION } from './fonts/font_family';

// TODO(kofi): Move to ./ui_strings/audio_only.tsx once all relevant code is
// updated to use that component.
export const AUDIO_ONLY_STYLES = css`
  clip-path: polygon(0 0, 0 0, 0 0);
  clip: rect(1px, 1px, 1px, 1px);
  height: 1px;
  overflow: hidden;
  position: absolute !important;
  width: 1px;
`;

export interface GlobalStylesProps {
  enableScroll: boolean;
  isTouchscreen: boolean;
  legacyBaseFontSizePx?: number;
  legacyPrintFontSizePx?: number;
}

/**
 * Common global styling for VxSuite apps.
 *
 * TODO: Copied from old App.css files in the frontend packages - could probably
 * use some cleanup and de-duping with the normalize.css styles we're already
 * importing.
 *
 * TODO: Hardcode base64-encoded versions of our font files and reference here,
 * so that everything's centralized and we don't have to have duplicate
 * copies in each app's package.
 */
export const GlobalStyles = createGlobalStyle<GlobalStylesProps>`
  *,
  *::before,
  *::after {
    box-sizing: inherit;
  }

  html {
    box-sizing: border-box;
    background: ${(p) => p.theme.colors.background};
    line-height: 1;
    color: ${(p) => p.theme.colors.onBackground};
    font-family: ${VX_DEFAULT_FONT_FAMILY_DECLARATION};
    font-size: ${(p) => p.legacyBaseFontSizePx || p.theme.sizes.fontDefault}px;
    font-weight: ${(p) => p.theme.sizes.fontWeight.regular};
    -moz-osx-font-smoothing: grayscale;
    -webkit-font-smoothing: antialiased;
    user-select: none;
  }

  @media print {
    html {
      background: #fff;
      color: #000;

      /* Adjust printed ballot font-size */
      font-size: ${(p) => p.legacyPrintFontSizePx ?? 16}px !important;
    }
  }

  body {
    margin: 0;
  }

  html,
  body,
  #root {
    height: 100%;
    overflow: ${(p) => (p.enableScroll ? 'auto' : 'hidden')};
    touch-action: none;
  }

  @media print {
    html,
    body {
      height: auto;
      overflow: visible;
    }

    #root {
      display: none; /* Do not print anything displayed in the app */
    }
  }

  b {
    font-weight: ${(p) => p.theme.sizes.fontWeight.bold};
  }

  table {
    border-collapse: collapse;
  }

  fieldset {
    margin: 0;
    border: none;
    padding: 0;
  }

  legend {
    display: block;
  }

  img {
    display: block;
  }

  select option {
    background-color: ${(p) => p.theme.colors.background};
    color: ${(p) => p.theme.colors.onBackground};

    &:disabled {
      background-color: ${(p) => p.theme.colors.container};
    }
  }

  :link,
  :visited {
    color: ${(p) => p.theme.colors.primary};
    font-weight: ${(p) => p.theme.sizes.fontWeight.semiBold};
  }

  :focus {
    outline: ${(p) =>
      p.isTouchscreen
        ? `${p.theme.colors.primary} dashed ${p.theme.sizes.bordersRem.medium}rem`
        : 'none'};
  }

  select:disabled {
    opacity: 1;
  }

  /* Hide scrollbars as Chrome on Linux displays them by default. This style also hides scrollbars when printing. */
  ::-webkit-scrollbar {
    display: none;
  }

  /* TODO(kofi): Update consumers to use the newer <AudioOnly> component. */
  .screen-reader-only {
    ${AUDIO_ONLY_STYLES}
  }

  /* TODO: Create components for these: */
  .print-only {
    display: none;
  }

  @media print {
    .print-only {
      display: block;
    }

    .no-print {
      display: none;
    }
  }
`;
