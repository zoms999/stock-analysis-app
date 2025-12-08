
"use client"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { useCopyToClipboard } from "@/hooks/use-copy-to-clipboard"
import { Check, Copy, Share2 } from "lucide-react"
import { toast } from "sonner"

interface ShareModalProps {
  inviteCode?: string
  children?: React.ReactNode
}

export function ShareModal({ inviteCode = "INVITE-2024-KM8Z", children }: ShareModalProps) {
  const { isCopied, copyToClipboard } = useCopyToClipboard()
  const inviteLink = `https://investcomm.com/invite/${inviteCode}`

  const handleCopy = () => {
    copyToClipboard(inviteLink)
    toast.success("초대 링크가 복사되었습니다!")
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        {children || (
          <Button variant="outline" size="sm" className="gap-2">
            <Share2 className="h-4 w-4" />
            공유하기
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>친구 초대하고 포인트 받기</DialogTitle>
          <DialogDescription>
            친구에게 초대 링크를 공유하세요. 친구가 가입하면 두 분 모두에게 <span className="text-yellow-500 font-bold">500P</span>를 드립니다.
          </DialogDescription>
        </DialogHeader>
        <div className="flex items-center space-x-2 py-4">
          <div className="grid flex-1 gap-2">
            <label htmlFor="link" className="sr-only">
              Link
            </label>
            <Input
              id="link"
              defaultValue={inviteLink}
              readOnly
              className="h-10 text-muted-foreground bg-secondary/50"
            />
          </div>
          <Button size="icon" onClick={handleCopy} className={isCopied ? "bg-green-600 hover:bg-green-700" : ""}>
            {isCopied ? <Check className="h-4 w-4 text-white" /> : <Copy className="h-4 w-4" />}
            <span className="sr-only">Copy</span>
          </Button>
        </div>
        <div className="flex justify-center gap-4 py-2">
           {/* Mock Social Buttons */}
            <Button variant="outline" className="w-full flex gap-2 border-yellow-400/20 hover:bg-yellow-400/10">
                <span className="text-yellow-500 font-bold">Kakao</span>
                Talk
            </Button>
             <Button variant="outline" className="w-full flex gap-2 border-blue-400/20 hover:bg-blue-400/10">
                <span className="text-blue-500 font-bold">Telegram</span>
                Share
            </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
