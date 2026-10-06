/**
 * Multi-Word & Indexed Search Engine Utility
 *
 * Provides tokenized multi-word search capabilities and an in-memory
 * index-behaving cache for sub-millisecond lookups across complex entity datasets.
 */

/**
 * Normalizes and splits a search string into distinct lowercase tokens.
 * Handles arbitrary whitespace, leading/trailing spaces, and empty queries.
 */
export function tokenizeSearchQuery(query: string | null | undefined): string[] {
  if (!query) return [];
  const normalized = query
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (!normalized) return [];
  return normalized.split(/\s+/).filter(token => token.length > 0);
}

/**
 * Flattens arbitrary entity attributes into a unified, normalized search document string.
 * Supports strings, numbers, booleans, null/undefined, and arrays.
 */
export function createSearchDocument(
  ...values: unknown[]
): string {
  const tokens: string[] = [];

  const extract = (val: unknown) => {
    if (val === null || val === undefined) return;
    if (Array.isArray(val)) {
      for (const item of val) extract(item);
    } else {
      const str = String(val).trim();
      if (str.length > 0) {
        tokens.push(
          str
            .toLowerCase()
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
        );
      }
    }
  };

  for (const v of values) {
    extract(v);
  }

  return tokens.join(" ");
}

/**
 * Evaluates whether a pre-created search document matches the search query.
 * Matches when EVERY query token is present anywhere in the document (AND condition across tokens).
 */
export function matchesSearchQuery(document: string, query: string | null | undefined): boolean {
  const queryTokens = tokenizeSearchQuery(query);
  if (queryTokens.length === 0) return true;

  const docLower = (document || "").toLowerCase();
  for (const token of queryTokens) {
    if (!docLower.includes(token)) {
      return false;
    }
  }
  return true;
}

/**
 * Higher-order helper to filter an array of items using a document extraction function.
 */
export function filterBySearchQuery<T>(
  items: T[],
  query: string | null | undefined,
  documentExtractor: (item: T) => string
): T[] {
  if (!items || items.length === 0) return [];
  const queryTokens = tokenizeSearchQuery(query);
  if (queryTokens.length === 0) return items;

  return items.filter(item => {
    const doc = documentExtractor(item).toLowerCase();
    for (const token of queryTokens) {
      if (!doc.includes(token)) {
        return false;
      }
    }
    return true;
  });
}

export interface ISearchIndex<T> {
  search: (query: string | null | undefined) => T[];
  update: (items: T[]) => void;
}

/**
 * In-memory index-behaving cache for large collections (e.g., 700+ users, 150+ teams).
 * Pre-computes normalized documents and provides sub-millisecond search execution.
 */
export function createSearchIndex<T>(
  items: T[],
  documentExtractor: (item: T) => string
): ISearchIndex<T> {
  let entries = items.map(item => ({
    item,
    document: documentExtractor(item).toLowerCase(),
  }));

  return {
    search(query: string | null | undefined): T[] {
      const queryTokens = tokenizeSearchQuery(query);
      if (queryTokens.length === 0) {
        return entries.map(e => e.item);
      }

      const results: T[] = [];
      for (const entry of entries) {
        let matchesAll = true;
        for (const token of queryTokens) {
          if (!entry.document.includes(token)) {
            matchesAll = false;
            break;
          }
        }
        if (matchesAll) {
          results.push(entry.item);
        }
      }
      return results;
    },
    update(newItems: T[]) {
      entries = newItems.map(item => ({
        item,
        document: documentExtractor(item).toLowerCase(),
      }));
    },
  };
}
