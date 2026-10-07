import type { ReactNode } from 'react'

export function ScreenHeader({ kicker, title, right }: { kicker?: ReactNode; title: ReactNode; right?: ReactNode }) {
  return (
    <header className="mb-6 flex items-end justify-between gap-3">
      <div className="min-w-0">
        {kicker && <p className="kicker">{kicker}</p>}
        <h1 className="display mt-1.5 truncate text-[44px] text-foam">{title}</h1>
      </div>
      {right}
    </header>
  )
}
