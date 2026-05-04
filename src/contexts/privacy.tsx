'use client'

import { createContext, useContext, useState } from 'react'

interface PrivacyContextValue {
  isPrivate: boolean
  toggle: () => void
}

const PrivacyContext = createContext<PrivacyContextValue>({ isPrivate: false, toggle: () => {} })

export function PrivacyProvider({ children }: { children: React.ReactNode }) {
  const [isPrivate, setIsPrivate] = useState(false)
  return (
    <PrivacyContext.Provider value={{ isPrivate, toggle: () => setIsPrivate(p => !p) }}>
      {children}
    </PrivacyContext.Provider>
  )
}

export function usePrivacy() {
  return useContext(PrivacyContext)
}
