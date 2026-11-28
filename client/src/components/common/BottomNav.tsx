import { Building2, Home as HomeIcon, MapPin, MessageCircle, UserRound } from "lucide-react";
import type { Tab } from "@/types";

export function BottomNav({ active, onChange }: { active: Tab; onChange: (tab: Tab) => void }) {
  const items: { id: Tab; label: string; icon: React.ReactNode }[] = [
    { id: "home", label: "홈", icon: <HomeIcon size={19} /> },
    { id: "listings", label: "매물", icon: <MapPin size={19} /> },
    { id: "chat", label: "채팅", icon: <MessageCircle size={19} /> },
    { id: "favorites", label: "내매물", icon: <Building2 size={19} /> },
    { id: "my", label: "MY", icon: <UserRound size={19} /> },
  ];

  return (
    <nav className="bottom-nav" aria-label="주요 메뉴">
      {items.map((item) => (
        <button
          key={item.id}
          className={`nav-item ${active === item.id ? "active" : ""}`}
          onClick={() => onChange(item.id)}
        >
          <span className="nav-icon">{item.icon}</span>
          <span>{item.label}</span>
          {item.id === "chat" && <span className="nav-dot" />}
        </button>
      ))}
    </nav>
  );
}
