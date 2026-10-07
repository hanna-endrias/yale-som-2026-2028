// The chat's bulldog mascot (an original drawing, not a Yale logo). Its expression
// follows the chat: idle, thinking (while the agent works), happy (products found),
// or sad (nothing found). Animations are in index.css and switch off for reduced motion.
export type BulldogMood = 'idle' | 'thinking' | 'happy' | 'sad'

const MOUTHS: Record<BulldogMood, string> = {
  idle: 'M27 45 q2.5 2.5 5 0 q2.5 2.5 5 0',
  thinking: 'M29 46 h6',
  happy: 'M25 44 q7 8 14 0',
  sad: 'M26 48 q6 -5 12 0',
}

export default function Bulldog({ mood = 'idle', size = 40 }: { mood?: BulldogMood; size?: number }) {
  return (
    <svg
      className={`bulldog bulldog-${mood}`}
      width={size}
      height={size}
      viewBox="0 0 64 64"
      role="img"
      aria-label={`Bulldog mascot, ${mood}`}
    >
      <g className="bulldog-head">
        <path className="bulldog-ear bulldog-ear-left" d="M12 22 L8 8 L24 16 Z" fill="#e2cfb4" stroke="#00356B" strokeWidth="2" strokeLinejoin="round" />
        <path className="bulldog-ear bulldog-ear-right" d="M52 22 L56 8 L40 16 Z" fill="#e2cfb4" stroke="#00356B" strokeWidth="2" strokeLinejoin="round" />
        <ellipse cx="32" cy="34" rx="22" ry="19" fill="#f3e6d3" stroke="#00356B" strokeWidth="2" />
        <ellipse cx="32" cy="43" rx="13" ry="9" fill="#ffffff" stroke="#00356B" strokeWidth="1.5" />
        <g className="bulldog-eyes">
          <circle cx="24" cy="30" r="2.6" fill="#1b2a3a" />
          <circle cx="40" cy="30" r="2.6" fill="#1b2a3a" />
        </g>
        {mood === 'sad' && (
          <path d="M20 25 l7 2 M44 25 l-7 2" stroke="#1b2a3a" strokeWidth="1.6" strokeLinecap="round" />
        )}
        <ellipse cx="32" cy="38" rx="4.5" ry="2.8" fill="#1b2a3a" />
        <path d={MOUTHS[mood]} fill="none" stroke="#1b2a3a" strokeWidth="1.8" strokeLinecap="round" />
        {mood === 'happy' && <ellipse cx="32" cy="49" rx="3" ry="2.4" fill="#ef7f9a" />}
      </g>
      <path d="M16 52 q16 9 32 0" fill="none" stroke="#286DC0" strokeWidth="4" strokeLinecap="round" />
      <circle cx="32" cy="58" r="3" fill="#FFD54A" stroke="#00356B" strokeWidth="1" />
      {mood === 'thinking' && (
        <g className="bulldog-thought" fill="#63AAFF">
          <circle cx="54" cy="12" r="2" />
          <circle cx="59" cy="6" r="2.6" />
        </g>
      )}
    </svg>
  )
}
