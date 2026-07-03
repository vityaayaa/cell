import { createContext, useContext, useEffect, useState, type ReactNode, type ElementType } from 'react'

export type HeaderAction = { label: string; icon: ElementType; onClick: () => void; badge?: number }

type ContextValue = { action: HeaderAction | null; setAction: (a: HeaderAction | null) => void }

export const HeaderActionContext = createContext<ContextValue>({ action: null, setAction: () => {} })

export function useHeaderAction() {
  return useContext(HeaderActionContext)
}

export function useRegisterHeaderAction(action: HeaderAction) {
  const { setAction } = useContext(HeaderActionContext)
  // Re-register whenever the visible bits change (label/icon/badge) so a live
  // badge count stays in sync. onClick is a fresh closure each render, so we
  // read the latest `action` inside the effect without depending on its identity.
  useEffect(() => {
    setAction(action)
    return () => setAction(null)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [action.label, action.icon, action.badge])
}

export function HeaderActionProvider({ children }: { children: ReactNode }) {
  const [action, setAction] = useState<HeaderAction | null>(null)
  return <HeaderActionContext.Provider value={{ action, setAction }}>{children}</HeaderActionContext.Provider>
}
