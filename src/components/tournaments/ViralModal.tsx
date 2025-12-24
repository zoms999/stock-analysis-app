'use client';

import { useState } from 'react';
import { createPortal } from 'react-dom';

interface ViralModalProps {
  isOpen: boolean;
  onClose: () => void;
  onShared: () => void;
  referralCode?: string;
  tournamentId: string;
}

export default function ViralModal({ isOpen, onClose, onShared, referralCode = 'USER_REF', tournamentId }: ViralModalProps) {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const shareUrl = `https://your-platform.com/tournaments/${tournamentId}?ref=${referralCode}`;
  const shareText = "시장 예측 대회에 참가하세요! 내 점수를 이겨보세요. 🚀 #Stock #Prediction";

  const handleShare = (platform: 'twitter' | 'telegram' | 'copy') => {
    let url = '';
    switch (platform) {
      case 'twitter':
        url = `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(shareUrl)}`;
        window.open(url, '_blank', 'width=600,height=400');
        onShared(); // Optimistic unlock
        break;
      case 'telegram':
        url = `https://t.me/share/url?url=${encodeURIComponent(shareUrl)}&text=${encodeURIComponent(shareText)}`;
        window.open(url, '_blank', 'width=600,height=400');
        onShared(); // Optimistic unlock
        break;
      case 'copy':
        navigator.clipboard.writeText(shareUrl);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        // For copy, we might not want to auto-unlock, but for now let's be generous or require a different trigger.
        // Let's unlock on copy too for better UX in this MVP.
        onShared();
        break;
    }
  };

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-gray-900 border border-purple-500/50 rounded-2xl p-6 w-full max-w-md shadow-2xl relative overflow-hidden">
        {/* Background glow */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
        
        <h2 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-400 mb-2 relative z-10">
          슬롯 2개 잠금 해제! 🔓
        </h2>
        <p className="text-gray-400 mb-6 text-sm relative z-10">
          친구들에게 대회를 공유하고 당첨 확률을 3배로 높이세요.
        </p>

        <div className="space-y-3 relative z-10">
          <button
            onClick={() => handleShare('twitter')}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-black border border-gray-800 hover:border-gray-600 hover:bg-gray-800 transition-all group"
          >
            <svg className="w-5 h-5 fill-white group-hover:scale-110 transition-transform" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/></svg>
            <span className="font-bold text-white">X(트위터)로 공유</span>
          </button>

          <button
            onClick={() => handleShare('telegram')}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-[#0088cc]/10 border border-[#0088cc]/50 hover:bg-[#0088cc]/20 transition-all group"
          >
            <svg className="w-5 h-5 fill-[#0088cc] group-hover:-translate-y-1 group-hover:translate-x-1 transition-transform" viewBox="0 0 24 24"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 11.944 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
            <span className="font-bold text-[#0088cc]">텔레그램으로 공유</span>
          </button>

          <button
            onClick={() => handleShare('copy')}
            className="w-full flex items-center justify-center gap-3 p-4 rounded-xl bg-gray-800 border border-gray-700 hover:bg-gray-700 transition-all text-gray-300"
          >
             {copied ? <span className="text-green-400 font-bold">복사 완료!</span> : <span>링크 복사</span>}
          </button>
        </div>

        <button 
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-500 hover:text-white"
        >
          ✕
        </button>
      </div>
    </div>,
    document.body
  );
}
