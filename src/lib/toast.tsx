import { toast } from 'sonner'
import { motion } from 'motion/react'

const prefersReduced =
  typeof window !== 'undefined' &&
  window.matchMedia('(prefers-reduced-motion: reduce)').matches

interface ProgressToastProps {
  message: string
  color: string
  duration: number
}

function ProgressToast({ message, color, duration }: ProgressToastProps) {
  return (
    <div
      className="relative overflow-hidden rounded-lg px-4 py-3 w-full"
      style={{ background: 'var(--card)', border: '1px solid var(--border)' }}
    >
      <p className="text-sm font-medium" style={{ color: 'var(--foreground)' }}>
        {message}
      </p>
      <motion.div
        className="absolute bottom-0 left-0 h-0.5"
        style={{ background: color }}
        initial={{ width: '100%' }}
        animate={{ width: '0%' }}
        transition={{ duration: prefersReduced ? 0 : duration / 1000, ease: 'linear' }}
      />
    </div>
  )
}

export function toastSuccess(message: string, duration = 2000) {
  toast.custom(
    () => <ProgressToast message={message} color="#10B981" duration={duration} />,
    { duration },
  )
}

export function toastError(message: string, duration = 3000) {
  toast.custom(
    () => <ProgressToast message={message} color="#EF4444" duration={duration} />,
    { duration },
  )
}

export function toastInfo(message: string, duration = 2000) {
  toast.custom(
    () => <ProgressToast message={message} color="var(--primary)" duration={duration} />,
    { duration },
  )
}
