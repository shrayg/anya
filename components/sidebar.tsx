"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { 
  LayoutDashboard, 
  Settings, 
  CreditCard, 
  HelpCircle,
  Mail,
  User,
  Phone,
  Search,
  Globe,
  Database,
  Car,
  Twitter,
  MessageSquare,
  Github,
  Monitor,
  MessageCircle,
  Gamepad2,
  Lock,
  Network,
  LogOut
} from "lucide-react";
import clsx from "clsx";

const mainNav = [
  { name: "MindMap", href: "/mindmap", icon: Network, shortcut: "CTRL+K", live: true },
  { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { name: "Settings", href: "/app/settings", icon: Settings },
  { name: "Pricing", href: "/pricing", icon: CreditCard },
  { name: "Support Center", href: "/app/support", icon: HelpCircle },
];

const osintTools = [
  { name: "Email Intel", href: "/osint/email", icon: Mail, live: true },
  { name: "Username Recon", href: "/osint/username", icon: User },
  { name: "Phone Tracer", href: "/osint/phone", icon: Phone },
  { name: "US People Finder", href: "/osint/us-npd", icon: Search },
  { name: "IP Tracer", href: "/osint/ip", icon: Globe, live: true },
  { name: "DNS Probe", href: "/osint/dns", icon: Network, live: true },
  { name: "DataHound", href: "/osint/datahound", icon: Database },
  { name: "VIN Decoder US", href: "/osint/vin", icon: Car },
  { name: "X / Twitter Intel", href: "/osint/twitter", icon: Twitter },
  { name: "Reddit Recon", href: "/osint/reddit", icon: MessageSquare, live: true },
  { name: "GitHub Profiler", href: "/osint/github", icon: Github },
  { name: "Device Inspector", href: "/osint/machine", icon: Monitor },
];

const gamingSocial = [
  { name: "Discord Recon", href: "/gaming/discord", icon: MessageCircle, live: true },
  { name: "Roblox Profiler", href: "/gaming/roblox", icon: Gamepad2, live: true },
  { name: "Minecraft Tracer", href: "/gaming/minecraft", icon: Gamepad2 },
];

const breachData = [
  { name: "Stealer Log Search", href: "/breach/stealer", icon: Lock },
  { name: "Email Leak Check", href: "/breach/email", icon: Mail, live: true }, 
];

function NavItem({ item, showDot }: { item: any; showDot?: boolean }) {
  const pathname = usePathname();
  const isActive = pathname === item.href;

  return (
    <Link
      href={item.href}
      className={clsx(
        "flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors",
        isActive 
          ? "bg-white text-black" 
          : "text-gray-400 hover:text-white hover:bg-white/5"
      )}
    >
      <div className="flex items-center gap-3">
        <item.icon className="w-4 h-4" />
        <span className="font-medium">{item.name}</span>
      </div>
      <div className="flex items-center gap-1.5">
        {showDot && (
          item.live ? (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-green-500" style={{ boxShadow: "0 0 4px #22c55e" }} />
            </span>
          ) : (
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500" style={{ boxShadow: "0 0 4px #ef4444" }} />
            </span>
          )
        )}
        {item.shortcut && (
          <span className="text-[10px] bg-white/10 px-1.5 py-0.5 rounded text-gray-500 font-mono">
            {item.shortcut}
          </span>
        )}
      </div>
    </Link>
  );
}

function NavSection({ title, items }: { title: string; items: any[] }) {
  return (
    <div className="mt-6">
      <div className="flex items-center justify-between px-3 mb-2">
        <h3 className="text-xs font-bold text-gray-500 uppercase tracking-wider">{title}</h3>
        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-gray-500"><path d="m6 9 6 6 6-6"/></svg>
      </div>
      <div className="flex flex-col gap-0.5 space-y-1">
        {items.map((item) => (
          <NavItem key={item.name} item={item} showDot />
        ))}
      </div>
    </div>
  );
}

export default function Sidebar() {
  return (
    <aside className="w-64 flex-shrink-0 bg-[#0a0a0a] border-r border-[#1f1f1f] h-screen overflow-y-auto no-scrollbar flex flex-col pt-4">
      {/* Search Modules Input */}
      <div className="px-4 mb-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
          <input 
            type="text" 
            placeholder="Search modules..." 
            className="w-full bg-[#141414] border border-[#2a2a2a] rounded-md py-1.5 pl-9 pr-3 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-white"
          />
        </div>
      </div>

      <div className="px-2 flex-grow pb-8">
        <div className="flex flex-col space-y-1">
          {mainNav.map((item) => (
            <NavItem key={item.name} item={item} />
          ))}
        </div>

        <NavSection title="OSINT TOOLS" items={osintTools} />
        <NavSection title="GAMING & SOCIAL" items={gamingSocial} />
        <NavSection title="BREACH DATA" items={breachData} />
      </div>

      {/* Logout Button */}
      <div className="p-4 border-t border-[#1f1f1f]">
        <button 
          onClick={() => {
            fetch("/api/auth/logout", { method: "POST" }).then(() => {
              window.location.href = "/";
            });
          }}
          className="flex items-center gap-3 w-full px-3 py-2 text-red-500 hover:bg-red-500/10 rounded-lg text-sm font-medium transition-colors"
        >
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </div>
    </aside>
  );
}
