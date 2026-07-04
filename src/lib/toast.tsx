import { toast } from 'sonner'
import { motion } from 'motion/react'

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface ProgressToastProps {
  message: string
  color: string
  duration: number
  onDismiss?: () => void
}

function ProgressToast({ message, color, duration, onDismiss }: ProgressToastProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg px-4 py-3 w-full cursor-pointer"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
      onClick={onDismiss}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {message}
      </p>
      <motion.div
        className="absolute bottom-0 left-0 h-1 rounded-full"
        style={{ background: color, opacity: 0.75 }}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: prefersReduced ? 0 : duration / 1000, ease: 'linear' }}
      />
    </div>
  )
}

export function toastSuccess(message: string, duration = 4000) {
  toast.custom(
    id => (
      <ProgressToast
        message={message}
        color="#10B981"
        duration={duration}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration },
  )
}

export function toastInfo(message: string, duration = 4000) {
  toast.custom(
    id => (
      <ProgressToast
        message={message}
        color="var(--primary)"
        duration={duration}
        onDismiss={() => toast.dismiss(id)}
      />
    ),
    { duration },
  )
}
