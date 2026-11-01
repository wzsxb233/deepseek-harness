/** Deterministic BM25 ranking for deferred tool discovery. */

const STOP_WORDS = new Set([
  'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from', 'in', 'is', 'it',
  'of', 'on', 'or', 'that', 'the', 'this', 'to', 'with',
])

function stem(term: string): string {
  if (term.length > 4 && term.endsWith('ies')) return `${term.slice(0, -3)}y`
  if (term.length > 4 && /(ches|shes|sses|xes|zes)$/u.test(term)) return term.slice(0, -2)
  if (term.length > 3 && term.endsWith('s') && !term.endsWith('ss')) return term.slice(0, -1)
  return term
}

/** Lowercase terms, split at camelCase boundaries and non-alphanumerics, without stop words.
 * @param text - text to tokenize.
 * @returns normalized searchable terms.
 */
export function tokenizeToolSearch(text: string): string[] {
  return text
    .replace(/([a-z0-9])([A-Z])/gu, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/gu, '$1 $2')
    .toLowerCase()
    .split(/[^a-z0-9]+/u)
    .filter(term => term.length > 0 && !STOP_WORDS.has(term))
    .map(stem)
}

/** A searchable tool document. */
export interface ToolSearchDocument {
  readonly name: string
  readonly text: string
}

/** Okapi BM25 ranking (k1 1.2, b 0.75), preserving document order on ties.
 * @param query - natural-language query.
 * @param documents - searchable documents in stable registry order.
 * @param limit - maximum number of names to return.
 * @returns matching document names, best first.
 */
export function rankToolSearch(query: string, documents: readonly ToolSearchDocument[], limit: number): string[] {
  const k1 = 1.2
  const b = 0.75
  const queryTerms = [...new Set(tokenizeToolSearch(query))]
  if (queryTerms.length === 0 || documents.length === 0 || limit <= 0) return []
  const termCounts = documents.map((document) => {
    const counts = new Map<string, number>()
    for (const term of tokenizeToolSearch(document.text)) counts.set(term, (counts.get(term) ?? 0) + 1)
    return counts
  })
  const lengths = termCounts.map(counts => [...counts.values()].reduce((sum, count) => sum + count, 0))
  const averageLength = lengths.reduce((sum, length) => sum + length, 0) / documents.length || 1
  const idf = new Map(queryTerms.map((term) => {
    const frequency = termCounts.filter(counts => counts.has(term)).length
    return [term, Math.log(1 + (documents.length - frequency + 0.5) / (frequency + 0.5))]
  }))
  const matches: { name: string; score: number; index: number }[] = []
  documents.forEach((document, index) => {
    let score = 0
    for (const term of queryTerms) {
      const count = termCounts[index]?.get(term)
      if (!count) continue
      const norm = k1 * (1 - b + (b * (lengths[index] ?? 0)) / averageLength)
      score += (idf.get(term) ?? 0) * ((count * (k1 + 1)) / (count + norm))
    }
    if (score > 0) matches.push({ name: document.name, score, index })
  })
  return matches
    .sort((left, right) => right.score - left.score || left.index - right.index)
    .slice(0, limit)
    .map(match => match.name)
}
