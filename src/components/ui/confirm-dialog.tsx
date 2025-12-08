"use client";

import React from "react";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  onConfirm: () => void;
  confirmJson?: string;
  cancelJson?: string;
}

export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  onConfirm,
  confirmJson = "확인",
  cancelJson = "취소",
}: ConfirmDialogProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-lg border border-border bg-card p-6 shadow-lg animate-in fade-in zoom-in-95 duration-200">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-foreground">{title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {description}
          </p>
        </div>
        <div className="flex justify-end gap-3">
          <button
            onClick={() => onOpenChange(false)}
            className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {cancelJson}
          </button>
          <button
            onClick={() => {
                onConfirm();
                onOpenChange(false);
            }}
            className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {confirmJson}
          </button>
        </div>
      </div>
    </div>
  );
}
