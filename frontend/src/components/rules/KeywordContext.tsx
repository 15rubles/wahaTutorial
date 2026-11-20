import { createContext, useContext } from 'react';

/**
 * Opens the rules popup for a glossary entry (DESIGN.md 8). The provider lives in the keyword popup
 * feature; without one, references render as plain highlighted text.
 */
export type OpenKeyword = (glossaryId: string | undefined, label: string, anchor?: HTMLElement) => void;

export const KeywordContext = createContext<OpenKeyword | null>(null);

export function useOpenKeyword(): OpenKeyword | null {
  return useContext(KeywordContext);
}
