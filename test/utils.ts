export const sleep = async (durationInSec: number) => {
    await new Promise(resolve => setTimeout(resolve, durationInSec * 1000))
}