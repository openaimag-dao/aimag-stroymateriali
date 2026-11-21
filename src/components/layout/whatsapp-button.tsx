"use client";

import { usePathname } from "next/navigation";
import { MessageCircle } from "lucide-react";
import { waLink } from "@/lib/whatsapp";

/** Плавающая кнопка чата WhatsApp; в админке не показывается. */
export function WhatsAppButton() {
  const path = usePathname();
  if (path?.startsWith("/admin")) return null;
  return (
    <a
      href={waLink("Здравствуйте! Вопрос по стройматериалам с сайта AIMAG.")}
      target="_blank"
      rel="noopener"
      aria-label="Написать в WhatsApp"
      className="fixed z-40 flex items-center gap-2 rounded-full bg-[#1f8f4e] px-4 py-3 text-[15px] font-semibold text-white shadow-lg transition hover:bg-[#187a41] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1f8f4e]"
      style={{
        right: "max(16px, calc(env(safe-area-inset-right, 0px) + 16px))",
        bottom: "max(16px, calc(env(safe-area-inset-bottom, 0px) + 16px))",
      }}
    >
      <MessageCircle className="h-5 w-5" aria-hidden="true" />
      <span className="hidden sm:inline">WhatsApp</span>
    </a>
  );
}
