"use client";

import { useState, useRef, KeyboardEvent } from "react";
import { Send, Attachment, Xmark } from "iconoir-react";
import { useTranslation } from "@/lib/i18n";

interface ChatMessageInputProps {
  onSend: (content: string, attachment?: File) => void;
  disabled?: boolean;
  placeholder?: string;
}

export function ChatMessageInput({ 
  onSend, 
  disabled = false, 
  placeholder
}: ChatMessageInputProps) {
  const { t } = useTranslation();
  const [message, setMessage] = useState("");
  const [attachment, setAttachment] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSend = () => {
    if ((!message.trim() && !attachment) || disabled) return;

    onSend(message, attachment || undefined);
    setMessage("");
    setAttachment(null);
    
    // Reset textarea height
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      // Check file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        alert(t("workspace.chat.area.fileSizeError"));
        return;
      }
      setAttachment(file);
    }
  };

  const removeAttachment = () => {
    setAttachment(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const adjustTextareaHeight = () => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = "auto";
      const newHeight = Math.min(textarea.scrollHeight, 120); // Max 120px
      textarea.style.height = `${newHeight}px`;
    }
  };

  return (
    <div className="space-y-3">
      {/* File Attachment Preview */}
      {attachment && (
        <div className="flex items-center gap-3 p-3 rounded-lg bg-surface-3 border border-surface-4">
          <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-surface-4">
            <Attachment className="h-4 w-4 text-text-muted" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-text-primary truncate">
              {attachment.name}
            </p>
            <p className="text-xs text-text-muted">
              {(attachment.size / 1024 / 1024).toFixed(2)} MB
            </p>
          </div>
          <button
            onClick={removeAttachment}
            className="inline-flex h-6 w-6 items-center justify-center rounded-full hover:bg-surface-4 text-text-muted hover:text-text-primary transition-colors"
          >
            <Xmark className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Message Input */}
      <div className="flex items-end gap-3">
        {/* File Upload */}
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileSelect}
          className="hidden"
          accept="image/*,application/pdf,.doc,.docx,.txt,.csv,.xlsx,.xls"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={disabled}
          className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-surface-4 bg-surface-3 text-text-muted transition-all duration-200 hover:border-brand-gold hover:bg-brand-gold/10 hover:text-brand-gold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Attachment className="h-4 w-4" />
        </button>

        {/* Text Input */}
        <div className="flex-1 relative">
          <textarea
            ref={textareaRef}
            value={message}
            onChange={(e) => {
              setMessage(e.target.value);
              adjustTextareaHeight();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder}
            disabled={disabled}
            rows={1}
            className="w-full resize-none rounded-lg border border-surface-4 bg-surface-3 px-4 py-3 pr-12 text-sm text-text-primary placeholder:text-text-muted transition-colors hover:border-surface-4 focus:outline-none focus:ring-2 focus:ring-brand-gold/20 disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ minHeight: "44px", maxHeight: "120px" }}
          />
          
          {/* Send Button */}
          <button
            onClick={handleSend}
            disabled={(!message.trim() && !attachment) || disabled}
            className="absolute right-2 bottom-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-brand-gold text-surface-1 transition-all duration-200 hover:bg-brand-gold-hover active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-brand-gold"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Helper Text */}
      <p className="text-xs text-text-muted">
        {t("workspace.chat.area.helperText")}
      </p>
    </div>
  );
}