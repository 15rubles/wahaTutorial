import type { NormalizedData } from '../normalize.js';
import { buildKeywordIndex } from './keywordIndex.js';
import { flattenRules, parseCoreRules } from './parseCoreRules.js';

export const CORE_RULES_FILE = 'core-rules.html';
export const CORE_RULES_URL = 'https://wahapedia.ru/wh40k11ed/the-rules/core-rules/';
export const RULES_APPENDIX_FILE = 'rules-appendix.html';
export const RULES_APPENDIX_URL = 'https://wahapedia.ru/wh40k11ed/the-rules/rules-appendix/';

/** Adds the core rules tree and keyword index to a normalized build. Mutates the report. */
export function addCoreRules(
  data: NormalizedData,
  files: Readonly<Record<string, string | undefined>>,
): Record<string, unknown> {
  const html = files[CORE_RULES_FILE];
  if (html === undefined) {
    data.report.errors.push({
      file: CORE_RULES_FILE,
      line: 0,
      category: 'missing-file',
      message: 'core rules page not in raw cache',
    });
    data.report.explanations['missing-file'] ??=
      'An expected file is not in the raw cache. Run npm run data:sync.';
    return {};
  }
  const appendix = files[RULES_APPENDIX_FILE];
  if (appendix === undefined) {
    data.report.warnings.push({
      file: RULES_APPENDIX_FILE,
      line: 0,
      category: 'missing-file',
      message: 'rules appendix not in raw cache; sub-rules come from tooltips only',
    });
    data.report.explanations['missing-file'] ??=
      'An expected file is not in the raw cache. Run npm run data:sync.';
  }
  const rules = parseCoreRules(
    html,
    { pageUrl: CORE_RULES_URL },
    appendix ? [{ html: appendix, pageUrl: RULES_APPENDIX_URL }] : [],
  );
  const result = buildKeywordIndex(rules.roots, data, rules);
  data.keywords = result.keywords;
  data.report.unresolvedKeywords = result.unresolved.sort((a, b) => b.uses - a.uses);
  data.report.counts['ruleSections'] = flattenRules(rules.roots).length;
  data.report.counts['resolvedKeywords'] = result.keywords.filter((k) => k.ruleId).length;
  data.report.counts['identityKeywords'] = result.identityKeywords;
  data.report.counts['unresolvedKeywords'] = result.unresolved.length;
  data.report.explanations['unresolved-keyword'] =
    'unresolvedKeywords lists every keyword that is not a faction or unit name keyword and has no matching core rules section (faction specific weapon rules, unit types such as Infantry that the core rules use without a dedicated section).';
  return {
    'rules.json': rules.roots,
    'rules-index.json': result.index,
    'keywords.json': data.keywords,
  };
}
