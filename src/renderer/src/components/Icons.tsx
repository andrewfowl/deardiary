interface IconProps {
  size?: number
}

function Svg({
  children,
  size = 18,
  filled = false
}: IconProps & { children: React.ReactNode; filled?: boolean }): React.JSX.Element {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill={filled ? 'currentColor' : 'none'}
      stroke={filled ? 'none' : 'currentColor'}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function TimelineIcon(props: IconProps): React.JSX.Element {
  return (
    <Svg {...props} filled>
      <rect x="4" y="4.5" width="13" height="3.4" rx="1.7" />
      <rect x="4" y="10.3" width="16" height="3.4" rx="1.7" />
      <rect x="4" y="16.1" width="9" height="3.4" rx="1.7" />
    </Svg>
  )
}

export function JournalIcon(props: IconProps): React.JSX.Element {
  return (
    <Svg {...props}>
      <rect x="5" y="3.5" width="14" height="17" rx="2" />
      <line x1="9.2" y1="3.5" x2="9.2" y2="20.5" />
      <line x1="12.5" y1="9" x2="15.8" y2="9" />
      <line x1="12.5" y1="13" x2="15.8" y2="13" />
    </Svg>
  )
}

export function ChatIcon(props: IconProps): React.JSX.Element {
  return (
    <Svg {...props}>
      <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9.5L5 20v-4H6a2 2 0 0 1-2-2z" />
      <line x1="8.5" y1="8.5" x2="15.5" y2="8.5" />
      <line x1="8.5" y1="12" x2="13" y2="12" />
    </Svg>
  )
}

export function SendIcon(props: IconProps): React.JSX.Element {
  return (
    <Svg {...props}>
      <path d="M21 3L10.5 13.5" />
      <path d="M21 3l-6.5 18-4-8.5L2 8.5z" />
    </Svg>
  )
}

export function SettingsIcon(props: IconProps): React.JSX.Element {
  return (
    <Svg {...props}>
      <line x1="4" y1="7" x2="20" y2="7" />
      <circle cx="9.5" cy="7" r="2.2" />
      <line x1="4" y1="16" x2="20" y2="16" />
      <circle cx="15" cy="16" r="2.2" />
    </Svg>
  )
}

export function ShieldIcon(props: IconProps): React.JSX.Element {
  return (
    <Svg {...props}>
      <path d="M12 3l7 3v5c0 4.5-3 8.2-7 10-4-1.8-7-5.5-7-10V6z" />
      <path d="M9 11.5l2 2 4-4.5" />
    </Svg>
  )
}

export function KeyIcon(props: IconProps): React.JSX.Element {
  return (
    <Svg {...props}>
      <circle cx="8" cy="14" r="4" />
      <path d="M11 11l9-9" />
      <path d="M17 5l3 3" />
      <path d="M14.5 7.5l2.5 2.5" />
    </Svg>
  )
}
