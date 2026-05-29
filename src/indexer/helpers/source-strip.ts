export function stripStringsAndComments(input: string): string {
    let out = ''
    let i = 0
    while (i < input.length) {
        const ch = input[i] as string
        if (ch === '#') {
            const nl = input.indexOf('\n', i)
            const stop = nl === -1 ? input.length : nl
            out += ' '.repeat(stop - i)
            i = stop
            continue
        }
        if (ch === '"' && input.startsWith('"""', i)) {
            const end = input.indexOf('"""', i + 3)
            const stop = end === -1 ? input.length : end + 3
            out += ' '.repeat(stop - i)
            i = stop
            continue
        }
        if (ch === '"') {
            const end = findStringEnd(input, i + 1)
            const stop = end === -1 ? input.length : end + 1
            out += ' '.repeat(stop - i)
            i = stop
            continue
        }
        out += ch
        i++
    }
    return out
}

function findStringEnd(s: string, from: number): number {
    for (let i = from; i < s.length; i++) {
        const ch = s[i] as string
        if (ch === '\\') {
            i++
            continue
        }
        if (ch === '"' || ch === '\n') return i
    }
    return -1
}
