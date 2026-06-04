import { motion } from 'motion/react'
import { useLocation } from 'react-router'

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return (
    <motion.div
      key={location.pathname}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: prefersReduced ? 0 : 0.15 }}
      style={{ minHeight: '100%' }}
    >
      {children}
    </motion.div>
  )
}
