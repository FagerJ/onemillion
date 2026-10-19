import { createContext, useContext } from 'react'

/** True while a milestone takeover is on screen. Combo toasts (G4) wait for it, so a
 *  toast never lands on top of a Golden Goal. */
export const TakeoverOpen = createContext(false)

export const useTakeoverOpen = () => useContext(TakeoverOpen)
