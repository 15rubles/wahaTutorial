import { Font } from '@react-pdf/renderer';
import atkinson400 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-normal.woff?url';
import atkinson400i from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-400-italic.woff?url';
import atkinson700 from '@fontsource/atkinson-hyperlegible/files/atkinson-hyperlegible-latin-700-normal.woff?url';
// IBM's complete WOFF: the subset files of other packages make react-pdf's font parser fail.
import plexMono500 from '@ibm/plex-mono/fonts/complete/woff/IBMPlexMono-Medium.woff?url';

let registered = false;

/** Embeds the app fonts in the PDF (DESIGN.md 9). */
export function registerFonts() {
  if (registered) return;
  registered = true;
  Font.register({
    family: 'Atkinson',
    fonts: [
      { src: atkinson400, fontWeight: 400 },
      { src: atkinson400i, fontWeight: 400, fontStyle: 'italic' },
      { src: atkinson700, fontWeight: 700 },
    ],
  });
  Font.register({ family: 'PlexMono', fonts: [{ src: plexMono500, fontWeight: 500 }] });
  // Keep words whole: rules text reads better without automatic hyphenation.
  Font.registerHyphenationCallback((word) => [word]);
}
