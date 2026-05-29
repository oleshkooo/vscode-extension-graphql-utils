export function levenshtein(a: string, b: string): number {
    if (a === b) return 0
    if (a.length === 0) return b.length
    if (b.length === 0) return a.length
    let prev = new Array<number>(b.length + 1)
    let curr = new Array<number>(b.length + 1)
    for (let j = 0; j <= b.length; j++) prev[j] = j
    for (let i = 1; i <= a.length; i++) {
        curr[0] = i
        for (let j = 1; j <= b.length; j++) {
            const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1
            const left = curr[j - 1] as number
            const above = prev[j] as number
            const diag = prev[j - 1] as number
            curr[j] = Math.min(left + 1, above + 1, diag + cost)
        }
        const tmp = prev
        prev = curr
        curr = tmp
    }
    return prev[b.length] as number
}
