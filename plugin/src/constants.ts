import { ArborSettings, Theme, ThemeKey } from "./types";

export const CARD_W     = 130;
export const CARD_H     = 58;
export const H_GAP      = 20;
export const SPOUSE_GAP = 12;
export const V_GAP      = 120;
export const MAX_LEN    = 18;

export const SHOW_SIBLINGS = true;

export const DEFAULT_SETTINGS: ArborSettings = {};

export const THEMES: Record<ThemeKey, Theme> = {
  dark: {
    containerBorder: "#2a3a4a",
    edge:            "#6a8aaa",
    edgeSib:         "#3a5a6a",
    spouseLine:      "#88aacc",
    rootBorder:      "#7080ff",
    text:            "#ffffff",
    textRoot:        "#ffffff",
    textSib:         "#aabbcc",
    dates:           "#88aacc",
    maleFill:        "#0a2a4a",
    maleBorder:      "#2a8acc",
    femaleFill:      "#3a0a2a",
    femaleBorder:    "#cc2a7a",
    unknownFill:     "#1a2030",
    unknownBorder:   "#6a8a9a",
    sibFill:         "#0a1018",
    sibBorder:       "#3a5a6a",
    toolbarBg:       "#0a0e18",
    toolbarBorder:   "#2a3a4a",
    btnBg:           "#1e2a3a",
    btnBorder:       "#6a9abb",
    btnColor:        "#ffffff",
    toggleLabel:     "☀ Light",
  },
  light: {
    containerBorder: "#8a7a6a",
    edge:            "#5a4a3a",
    edgeSib:         "#8a7a6a",
    spouseLine:      "#4a6a8a",
    rootBorder:      "#2030aa",
    text:            "#0a0a0a",
    textRoot:        "#ffffff",
    textSib:         "#3a2a1a",
    dates:           "#3a2a1a",
    maleFill:        "#a0cce8",
    maleBorder:      "#0a4a7a",
    femaleFill:      "#e8a0c0",
    femaleBorder:    "#7a0a3a",
    unknownFill:     "#d8d0c0",
    unknownBorder:   "#5a4a3a",
    sibFill:         "#c8c0b0",
    sibBorder:       "#7a6a5a",
    toolbarBg:       "#e0d8c8",
    toolbarBorder:   "#8a7a6a",
    btnBg:           "#c8c0b0",
    btnBorder:       "#6a5a4a",
    btnColor:        "#0a0a0a",
    toggleLabel:     "🌙 Dark",
  },
};
