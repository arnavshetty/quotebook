import { Feather } from 'lucide-react'

export default function Logo({ size = 32 }) {
  return (
    <Feather
      className="logo-icon"
      size={size}
      strokeWidth={2}
      aria-hidden="true"
    />
  )
}
