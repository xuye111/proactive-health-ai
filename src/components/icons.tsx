import type { SVGProps } from 'react'

/** 统一的线性图标：24×24、stroke=currentColor，尺寸由 className 控制。 */
const base = (props: SVGProps<SVGSVGElement>) => ({
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.7,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  ...props,
})

export const IconHome = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M4 10.5 12 4l8 6.5" />
    <path d="M6 9.8V19a1 1 0 0 0 1 1h3.2v-4.2h3.6V20H17a1 1 0 0 0 1-1V9.8" />
  </svg>
)

export const IconSparkle = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M12 3.5l1.6 4.4 4.4 1.6-4.4 1.6L12 15.5l-1.6-4.4L6 9.5l4.4-1.6z" />
    <path d="M18 16l.7 1.8 1.8.7-1.8.7-.7 1.8-.7-1.8-1.8-.7 1.8-.7z" />
  </svg>
)

export const IconRecord = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M12 5v14M5 12h14" />
  </svg>
)

export const IconChart = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M4 19h16" />
    <path d="M7 19v-5M12 19V8M17 19v-8" />
  </svg>
)

export const IconTarget = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="7.5" />
    <circle cx="12" cy="12" r="3" />
  </svg>
)

export const IconUser = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="8.5" r="3.5" />
    <path d="M5.5 19.5c.9-3.2 3.4-5 6.5-5s5.6 1.8 6.5 5" />
  </svg>
)

export const IconChevronRight = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M9.5 6l6 6-6 6" />
  </svg>
)

export const IconChevronLeft = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M14.5 6l-6 6 6 6" />
  </svg>
)

export const IconCheck = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M5 12.5l4.5 4.5L19 7.5" />
  </svg>
)

export const IconSleep = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M20 14.5A8.5 8.5 0 0 1 9.5 4a8.5 8.5 0 1 0 10.5 10.5z" />
  </svg>
)

export const IconActivity = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M13.5 3.5 6 13h5l-.5 7.5L18 11h-5z" />
  </svg>
)

export const IconDiet = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M6 3.5v7a3 3 0 0 0 6 0v-7" />
    <path d="M9 10.5V20.5" />
    <path d="M16.5 3.5c1.7 1.2 2.5 3 2.5 5.5s-.8 3.4-2.5 4v7.5" />
  </svg>
)

export const IconMood = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="12" r="8.5" />
    <path d="M9 14.5c.8.9 1.8 1.3 3 1.3s2.2-.4 3-1.3" />
    <path d="M9.2 9.8h.01M14.8 9.8h.01" strokeWidth={2.4} />
  </svg>
)

export const IconShield = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M12 3.5 5.5 6v6c0 4 2.7 7.2 6.5 8.5 3.8-1.3 6.5-4.5 6.5-8.5V6z" />
    <path d="M9.5 12l1.8 1.8 3.4-3.6" />
  </svg>
)

export const IconBrain = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M9.5 5.5A2.8 2.8 0 0 0 6.7 8.3 2.6 2.6 0 0 0 5 10.7c0 1 .5 1.8 1.3 2.3-.2.4-.3.8-.3 1.3a2.7 2.7 0 0 0 2.7 2.7c.3.9 1.1 1.5 2.1 1.5h.7V5.5z" />
    <path d="M14.5 5.5a2.8 2.8 0 0 1 2.8 2.8 2.6 2.6 0 0 1 1.7 2.4c0 1-.5 1.8-1.3 2.3.2.4.3.8.3 1.3a2.7 2.7 0 0 1-2.7 2.7c-.3.9-1.1 1.5-2.1 1.5h-.7V5.5z" />
  </svg>
)

export const IconBook = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H12v16H6.5a2 2 0 0 0-2 2z" />
    <path d="M19.5 5.5a2 2 0 0 0-2-2H12v16h5.5a2 2 0 0 1 2 2z" />
  </svg>
)

export const IconGraph = (props: SVGProps<SVGSVGElement>) => (
  <svg {...base(props)}>
    <circle cx="12" cy="5.5" r="2.2" />
    <circle cx="5.5" cy="17" r="2.2" />
    <circle cx="18.5" cy="17" r="2.2" />
    <path d="M10.4 7.4 7 14.9M13.6 7.4 17 14.9M7.7 17h8.6" />
  </svg>
)
