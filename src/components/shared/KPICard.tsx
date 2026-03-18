import { useState } from 'react'
import { ArrowUp, ArrowDown, Info } from 'lucide-react'
import { cn } from '@/lib/cn'

interface KPICardProps {
  title: string
  value: string
  change?: string
  changePositive?: boolean
  icon?: React.ReactNode
  subtitle?: string
  tooltip?: string
}

export function KPICard({
  title,
  value,
  change,
  changePositive,
  icon,
  subtitle,
  tooltip,
}: KPICardProps) {
  const [showTooltip, setShowTooltip] = useState(false)

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium text-gray-500">{title}</p>
            {tooltip && (
              <div className="relative">
                <Info
                  size={14}
                  className="text-gray-300 hover:text-gray-500 cursor-help transition-colors"
                  onMouseEnter={() => setShowTooltip(true)}
                  onMouseLeave={() => setShowTooltip(false)}
                />
                {showTooltip && (
                  <div className="absolute z-50 bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 px-3 py-2 text-xs text-gray-700 bg-white border border-gray-200 rounded-lg shadow-lg leading-relaxed">
                    {tooltip}
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px border-4 border-transparent border-t-gray-200" />
                    <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-[5px] border-4 border-transparent border-t-white" />
                  </div>
                )}
              </div>
            )}
          </div>
          <p className="mt-1.5 text-2xl font-bold text-gray-900">{value}</p>

          {(change || subtitle) && (
            <div className="mt-1.5 flex items-center gap-2">
              {change && (
                <span
                  className={cn(
                    'inline-flex items-center gap-0.5 text-xs font-medium',
                    changePositive ? 'text-green-600' : 'text-red-500'
                  )}
                >
                  {changePositive ? (
                    <ArrowUp size={12} />
                  ) : (
                    <ArrowDown size={12} />
                  )}
                  {change}
                </span>
              )}
              {subtitle && (
                <span className="text-xs text-gray-400">{subtitle}</span>
              )}
            </div>
          )}
        </div>

        {icon && (
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-blue-50 text-blue-500 shrink-0">
            {icon}
          </div>
        )}
      </div>
    </div>
  )
}
