import { AnimatePresence, motion } from 'motion/react'
import { useLocation } from 'react-router'

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

const variants = {
  enter: { x: prefersReduced ? 0 : '100%', opacity: prefersReduced ? 0 : 1 },
  center: { x: 0, opacity: 1 },
  exit: { x: prefersReduced ? 0 : '-30%', opacity: 0 },
}

export function PageTransition({ children }: { children: React.ReactNode }) {
  const location = useLocation()
  return (
    <AnimatePresence mode="wait" initial={false}>
      <motion.div
        key={location.pathname}
        variants={variants}
        initial="enter"
        animate="center"
        exit="exit"
        transition={{
          duration: prefersReduced ? 0 : 0.2,
          ease: 'easeInOut',
        }}
        style={{ minHeight: '100%' }}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  )
}
