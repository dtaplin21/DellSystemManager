"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface SwitchProps extends React.HTMLAttributes<HTMLDivElement> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
  disabled?: boolean;
}

const Switch = React.forwardRef<HTMLDivElement, SwitchProps>(
  ({ className, checked = false, onCheckedChange, disabled = false, ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "relative inline-flex h-[24px] w-[44px] shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors",
          checked ? "bg-blue-600" : "bg-gray-200",
          disabled ? "cursor-not-allowed opacity-50" : "",
          className
        )}
        onClick={() => !disabled && onCheckedChange && onCheckedChange(!checked)}
        {...props}
      >
        <span
          className={cn(
            "pointer-events-none block h-5 w-5 rounded-full bg-white shadow-lg transition-transform",
            checked ? "translate-x-5" : "translate-x-0"
          )}
        />
      </div>
    )
  }
)

Switch.displayName = "Switch"

export { Switch }