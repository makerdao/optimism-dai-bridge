import { AuthableContract } from './AuthableContract'

/**
 * Gets all active wards of a given contract. Turns out that it's not so trivial since events might be quite misleading.
 */
export async function getActiveWards(authContract: AuthableContract): Promise<string[]> {
  const relyEvents = await authContract.queryFilter(authContract.filters.Rely())

  const relies = relyEvents.map((r) => r.args.usr)

  const statusOfRelies = await Promise.all(relies.map(async (usr) => ({ usr, active: await authContract.wards(usr) })))

  const activeRelies = statusOfRelies.filter((s) => s.active.toNumber() === 1).map((s) => s.usr)

  return activeRelies
}
