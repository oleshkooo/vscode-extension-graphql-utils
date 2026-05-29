import { levenshtein } from '../../utils/levenshtein'

export function thresholdFor(length: number): number {
    if (length <= 7) return 2
    return 3
}

export function rankSuggestions(target: string, candidates: Iterable<string>, maxResults = 3): string[] {
    const threshold = thresholdFor(target.length)
    const targetLower = target.toLowerCase()
    const scored: { name: string; dist: number }[] = []
    const seen = new Set<string>()
    for (const candidate of candidates) {
        if (candidate === target) continue
        if (seen.has(candidate)) continue
        seen.add(candidate)
        const dist = levenshtein(targetLower, candidate.toLowerCase())
        if (dist > threshold) continue
        scored.push({ name: candidate, dist })
    }
    scored.sort((a, b) => a.dist - b.dist || a.name.localeCompare(b.name))
    return scored.slice(0, maxResults).map(s => s.name)
}
