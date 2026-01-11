'use client'

import { FC } from 'react'
import Image from 'next/image'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

interface GoogleOneTapProps {
  appName?: string
  userInfo?: {
    name: string
    email: string
    avatarUrl?: string
  }
  onContinue?: () => void
  onClose?: () => void
  className?: string
}

export const GoogleOneTap: FC<GoogleOneTapProps> = ({
  appName = 'InvestComm',
  userInfo = {
    name: '로그인하기',
    email: 'Google 계정으로 계속하기',
    avatarUrl: ''
  },
  onContinue,
  onClose,
  className
}) => {
  return (
    <AnimatePresence>
      <motion.div
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: -20, opacity: 0 }}
        className={`fixed right-4 top-4 z-50 w-full max-w-[375px] overflow-hidden rounded-lg border border-border bg-background shadow-lg md:right-4 md:top-4 ${className}`}
        style={{ fontFamily: 'system-ui, -apple-system, sans-serif' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border p-3">
          <div className="flex items-center gap-2">
            <div className="flex h-5 w-5 items-center justify-center">
              <svg viewBox="0 0 24 24" className="h-full w-full">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
            </div>
            <span className="text-sm text-muted-foreground">
              <span className="font-semibold text-foreground">google.com</span>의 계정으로 <span className="font-semibold text-foreground">{appName}</span>에 로그인하세요
            </span>
          </div>
          <button 
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground hover:bg-muted"
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="h-10 w-10 overflow-hidden rounded-full bg-muted">
              {userInfo.avatarUrl ? (
                <Image 
                  src={userInfo.avatarUrl} 
                  alt={userInfo.name}
                  width={40}
                  height={40}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full items-center justify-center bg-blue-100 text-blue-600 font-semibold">
                  {userInfo.name.slice(0, 1)}
                </div>
              )}
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-medium text-foreground">{userInfo.name}</span>
              <span className="text-xs text-muted-foreground">{userInfo.email}</span>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={onContinue}
            className="w-full rounded-full bg-[#1A73E8] py-2 text-sm font-medium text-white transition-colors hover:bg-[#1557B0]"
          >
            {userInfo.name === '로그인하기' ? 'Google 계정으로 계속' : `${userInfo.name} 계정으로 계속`}
          </button>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
