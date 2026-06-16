const PALETTE = [
  'bg-blue-500', 'bg-emerald-500', 'bg-violet-500', 'bg-rose-500',
  'bg-amber-500', 'bg-cyan-500', 'bg-pink-500', 'bg-indigo-500',
]

function colorFor(name: string): string {
  const hash = name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0)
  return PALETTE[hash % PALETTE.length]
}

function initials(name: string): string {
  return name
    .split(' ')
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)
}

interface AvatarProps {
  name: string
  imageUrl?: string | null
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

const SIZE: Record<string, string> = {
  sm: 'w-7 h-7 text-xs',
  md: 'w-10 h-10 text-sm',
  lg: 'w-16 h-16 text-xl',
}

export default function Avatar({ name, imageUrl, size = 'md', className = '' }: AvatarProps) {
  if (imageUrl) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imageUrl}
        alt={name}
        className={`${SIZE[size]} rounded-full object-cover select-none shrink-0 bg-slate-100 ${className}`}
      />
    )
  }
  return (
    <div
      className={`${SIZE[size]} ${colorFor(name)} rounded-full flex items-center justify-center font-bold text-white select-none shrink-0 ${className}`}
    >
      {initials(name)}
    </div>
  )
}
