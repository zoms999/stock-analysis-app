
"use client"

import * as React from "react"

export function useCopyToClipboard() {
  const [isCopied, setIsCopied] = React.useState(false)

  const copyToClipboard = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
      return true
    } catch (error) {
      console.error("Failed to copy:", error)
      setIsCopied(false)
      return false
    }
  }

  return { isCopied, copyToClipboard }
}
