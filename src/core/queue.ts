export const createQueue = () => {
  let queue: Promise<unknown> = Promise.resolve()

  return <T>(task: () => Promise<T>) => {
    const result = queue.then(task)
    queue = result.catch(() => undefined)
    return result
  }
}
