import { pdf } from '@react-pdf/renderer';
import { createElement } from 'react';
import type { ExportData, ExportSettings } from '../types';
import { registerFonts } from './fonts';
import { RosterPdf } from './RosterPdf';

/** Renders the PDF in the browser and returns it as a Blob. Loaded lazily (react-pdf is large). */
export async function renderPdf(data: ExportData, settings: ExportSettings): Promise<Blob> {
  registerFonts();
  return pdf(createElement(RosterPdf, { data, settings }) as any).toBlob();
}
