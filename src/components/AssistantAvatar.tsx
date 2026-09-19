import { useId } from 'react'

interface AssistantAvatarProps {
  /** 像素尺寸；SVG 等比缩放，小到 20px 也保持可辨。 */
  size?: number
  /** 右下角状态点：表示「一直在看」，与主动健康的定位呼应。 */
  online?: boolean
  className?: string
}

/**
 * 健康小助手「小满」的头像：青绿渐变圆底 + 极简面部。
 *
 * 设计取舍：用平静的椭圆眼与浅弧嘴，避免圆眼高光那种儿童化处理；
 * 底色沿用产品图标的青绿渐变，保持和 App 图标同一套视觉语言。
 */
export function AssistantAvatar({ size = 28, online = false, className }: AssistantAvatarProps) {
  const gradientId = useId()

  return (
    <span
      className={`relative inline-flex shrink-0 ${className ?? ''}`}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" className="size-full" role="img" aria-label="小满">
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#14b8a6" />
            <stop offset="100%" stopColor="#0f766e" />
          </linearGradient>
        </defs>
        <circle cx="32" cy="32" r="32" fill={`url(#${gradientId})`} />
        <ellipse cx="24.2" cy="27.4" rx="2.95" ry="3.45" fill="#ffffff" />
        <ellipse cx="39.8" cy="27.4" rx="2.95" ry="3.45" fill="#ffffff" />
        <path
          d="M26.6 37.4c1.6 2.2 3.5 3.3 5.4 3.3s3.8-1.1 5.4-3.3"
          fill="none"
          stroke="#ffffff"
          strokeWidth="2.9"
          strokeLinecap="round"
        />
      </svg>
      {online && (
        <span
          className="absolute right-0 bottom-0 rounded-full border-2 border-surface bg-brand"
          style={{ width: `${Math.max(size * 0.3, 7)}px`, height: `${Math.max(size * 0.3, 7)}px` }}
        />
      )}
    </span>
  )
}
