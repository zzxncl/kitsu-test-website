/* KITSU/LIVE — skin registry.
 * Each entry matches a file in css/skins/. The swatches here are only for
 * the picker preview; the real values live in the CSS. */
export const SKINS = [
  {
    id: 'press',
    name: 'Press',
    blurb: 'Editorial brutalism. Hairline rules, condensed poster type, hard-offset hovers.',
    face: 'Anton',
    bg: '#0b0b0c', fg: '#efece3', accent: '#ff3b18', alt: '#ccff00',
    radius: '0px',
  },
  {
    id: 'vault',
    name: 'Vault',
    blurb: 'The modern streaming look, done carefully. Deep slate, soft depth, one electric accent.',
    face: 'Space Grotesk',
    bg: '#0d1117', fg: '#e9eef5', accent: '#4d8dff', alt: '#42e3b0',
    radius: '16px',
  },
  {
    id: 'neon',
    name: 'Neon',
    blurb: 'Late-night arcade. Black glass, magenta and cyan, scanlines. Hits hardest with ambient light.',
    face: 'Archivo Black',
    bg: '#05050b', fg: '#eaf2ff', accent: '#ff00a0', alt: '#00e5ff',
    radius: '2px',
  },
  {
    id: 'linen',
    name: 'Linen',
    blurb: 'Warm paper and an italic serif. A reading room rather than a dashboard.',
    face: 'Instrument Serif',
    bg: '#faf6ef', fg: '#241f1a', accent: '#b44b2c', alt: '#4a7c59',
    radius: '18px',
  },
  {
    id: 'noir',
    name: 'Noir',
    blurb: 'Cinema. Pure greyscale, one blood accent, chrome almost absent. The art carries it.',
    face: 'Archivo Black',
    bg: '#090909', fg: '#f5f5f5', accent: '#e5243b', alt: '#9a9a9a',
    radius: '2px',
  },
];

export const SKIN_IDS = SKINS.map((s) => s.id);
export const getSkin = (id) => SKINS.find((s) => s.id === id) || SKINS[0];

/** Each skin has a natural default theme; linen is a light design. */
export const SKIN_DEFAULT_THEME = { press: 'ink', vault: 'ink', neon: 'ink', linen: 'paper', noir: 'ink' };
