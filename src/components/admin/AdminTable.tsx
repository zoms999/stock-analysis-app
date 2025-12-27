import * as React from "react"
import { cn } from "@/lib/utils"
import { Card } from "@/components/ui/card"

export function AdminTableCard({
  className,
  children,
}: {
  className?: string
  children: React.ReactNode
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="overflow-x-auto">{children}</div>
    </Card>
  )
}






