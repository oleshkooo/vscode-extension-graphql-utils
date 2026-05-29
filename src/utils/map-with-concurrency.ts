export async function mapWithConcurrency<T, R>(
    items: readonly T[],
    limit: number,
    fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
    if (items.length === 0) return []
    const effectiveLimit = Math.max(1, Math.min(limit, items.length))
    const results = new Array<R>(items.length)
    let next = 0

    const worker = async (): Promise<void> => {
        while (true) {
            const i = next++
            if (i >= items.length) return
            results[i] = await fn(items[i] as T, i)
        }
    }

    const workers: Promise<void>[] = []
    for (let i = 0; i < effectiveLimit; i++) workers.push(worker())
    await Promise.all(workers)
    return results
}
