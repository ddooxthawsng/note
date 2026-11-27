import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/shared/utils/cn'

export interface SelectOption {
  value: string
  label: string
}

interface CustomSelectProps {
  value: string
  options: SelectOption[]
  onChange: (value: string) => void
  placeholder?: string
  ariaLabel?: string
  title?: string
  className?: string
  size?: 'sm' | 'md'
}

export default function CustomSelect({
  value,
  options,
  onChange,
  placeholder = 'Select...',
  ariaLabel,
  title,
  className,
  size = 'md',
}: CustomSelectProps) {
  const [open, setOpen] = useState(false)
  const [coords, setCoords] = useState<{ top: number; left: number; width: number }>({ top: 0, left: 0, width: 160 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  const selected = options.find((opt) => opt.value === value)

  function updatePosition() {
    if (!buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    const menuWidth = Math.max(rect.width, 160)
    const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8)
    const estimatedHeight = Math.min(240, options.length * 36 + 12)
    const openUp = rect.bottom + estimatedHeight > window.innerHeight - 12 && rect.top > estimatedHeight
    setCoords({
      top: openUp ? Math.max(8, rect.top - estimatedHeight - 4) : rect.bottom + 4,
      left: Math.min(rect.left, maxLeft),
      width: menuWidth,
    })
  }

  useEffect(() => {
    if (!open) return
    updatePosition()

    function handleOutside(e: MouseEvent) {
      if (
        buttonRef.current?.contains(e.target as Node) ||
        menuRef.current?.contains(e.target as Node)
      ) {
        return
      }
      setOpen(false)
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    function handleScrollOrResize() {
      updatePosition()
    }

    document.addEventListener('mousedown', handleOutside)
    document.addEventListener('keydown', handleKey)
    window.addEventListener('resize', handleScrollOrResize)
    window.addEventListener('scroll', handleScrollOrResize, true)
    return () => {
      document.removeEventListener('mousedown', handleOutside)
      document.removeEventListener('keydown', handleKey)
      window.removeEventListener('resize', handleScrollOrResize)
      window.removeEventListener('scroll', handleScrollOrResize, true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, options.length])

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label={ariaLabel}
        title={title}
        onClick={() => setOpen((prev) => !prev)}
        className={cn(
          'inline-flex items-center justify-between gap-2 rounded-xl border border-hairline bg-canvas/90 text-left font-medium text-ink transition hover:border-primary/60 focus:border-primary focus:outline-none dark:border-gray-800 dark:bg-dark/90 dark:text-gray-200',
          size === 'sm' ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-2 text-sm',
          open && 'border-primary ring-2 ring-primary/15',
          className,
        )}
      >
        <span className="truncate">{selected?.label ?? placeholder}</span>
        <ChevronDown size={size === 'sm' ? 13 : 15} className={cn('shrink-0 text-ink-muted transition-transform', open && 'rotate-180 text-primary')} />
      </button>

      {open &&
        createPortal(
          <div
            ref={menuRef}
            style={{ top: coords.top, left: coords.left, minWidth: coords.width }}
            className="fixed z-[100] max-h-60 overflow-y-auto rounded-xl border border-hairline bg-canvas/95 p-1 shadow-2xl backdrop-blur-xl animate-scale-in dark:border-gray-800 dark:bg-dark-elevated/95"
          >
            {options.map((opt) => {
              const active = opt.value === value
              return (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => {
                    onChange(opt.value)
                    setOpen(false)
                  }}
                  className={cn(
                    'flex w-full items-center justify-between gap-2 rounded-lg px-2.5 py-1.5 text-left text-xs font-medium transition',
                    active
                      ? 'bg-primary text-white'
                      : 'text-ink-body hover:bg-canvas-card hover:text-ink dark:text-gray-300 dark:hover:bg-dark',
                  )}
                >
                  <span className="truncate">{opt.label}</span>
                  {active && <Check size={13} className="shrink-0" />}
                </button>
              )
            })}
          </div>,
          document.body,
        )}
    </>
  )
}
