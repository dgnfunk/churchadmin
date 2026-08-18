"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useAppState } from "@/components/AppStateProvider";
import { logoutAction } from "@/lib/auth-actions";
import type { Permission, User } from "@/lib/domain";
import { canAccess } from "@/lib/permissions";
import { Banknote, CalendarDays, ChevronLeft, Church, House, Image, Megaphone, Menu, Palette, Users, UserRoundCog, X, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { ColorModeToggle } from "@/components/ColorModeToggle";

const navItems: Array<{
  href: string;
  label: string;
  icon: LucideIcon;
  group: "Operación" | "Recursos" | "Administración";
  permission?: Permission;
}> = [
  { href: "/services", label: "Servicios", icon: CalendarDays, group: "Operación", permission: "services.view" },
  { href: "/attendance", label: "Asistencia", icon: Church, group: "Operación", permission: "attendance.history.view" },
  { href: "/people", label: "Personas", icon: Users, group: "Operación", permission: "people.view" },
  { href: "/media", label: "Multimedia", icon: Image, group: "Recursos", permission: "media.manage" },
  { href: "/communications", label: "Comunicaciones", icon: Megaphone, group: "Recursos", permission: "communications.view" },
  { href: "/offerings", label: "Ofrendas", icon: Banknote, group: "Administración", permission: "offerings.audit.view" },
  { href: "/ministry", label: "Ministerios", icon: UserRoundCog, group: "Administración", permission: "ministry.manage" },
  { href: "/users", label: "Usuarios", icon: Users, group: "Administración", permission: "users.manage" },
  { href: "/theme", label: "Apariencia", icon: Palette, group: "Administración", permission: "theme.manage" },
];

export function AppShell({ children, currentUser }: { children: React.ReactNode; currentUser: User | null }) {
  const { church } = useAppState();
  const pathname = usePathname();
  const [navigationOpen, setNavigationOpen] = useState(false);

  if (!currentUser || pathname === "/login" || pathname.startsWith("/check-in") || pathname === "/welcome" || pathname === "/offline") {
    return <main className="public-main">{children}</main>;
  }

  const initials = church.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "CA";
  const visibleNavItems = navItems.filter((item) => item.href === "/services"
    ? canAccess(currentUser, "services.view") || canAccess(currentUser, "schedule.view.own") || canAccess(currentUser, "schedule.propose")
    : item.href === "/offerings"
      ? canAccess(currentUser, "offerings.capture") || canAccess(currentUser, "offerings.audit.view")
    : !item.permission || canAccess(currentUser, item.permission));

  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  return (
    <div className="app-shell">
      <header className="mobile-header"><button aria-label="Abrir navegación" className="icon-button" onClick={() => setNavigationOpen(true)}><Menu /></button><strong>{church.name}</strong></header>
      {navigationOpen ? <button aria-label="Cerrar navegación" className="nav-scrim" onClick={() => setNavigationOpen(false)} /> : null}
      <aside className={`sidebar ${navigationOpen ? "open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">{initials}</div>
          <div>
            <p className="brand-name">{church.name}</p>
            <p className="brand-subtitle">Administración de la iglesia</p>
          </div>
          <button aria-label="Cerrar navegación" className="icon-button sidebar-close" onClick={() => setNavigationOpen(false)}><X /></button>
        </div>
        <nav className="nav" aria-label="Navegación principal">
          <Link aria-current={pathname === "/" ? "page" : undefined} className={pathname === "/" ? "active" : undefined} href="/" onClick={() => setNavigationOpen(false)}><House />Inicio</Link>
          {(["Operación", "Recursos", "Administración"] as const).map((group) => <div className="nav-group" key={group}><p>{group}</p>{visibleNavItems.filter((item) => item.group === group).map((item) => {
            const Icon = item.icon;
            return (
            <Link
              aria-current={isActive(item.href) ? "page" : undefined}
              className={isActive(item.href) ? "active" : undefined}
              key={item.href}
              href={item.href}
              onClick={() => setNavigationOpen(false)}
            >
              <Icon />
              {item.label}
            </Link>
          );})}</div>)}
        </nav>
        <div className="sidebar-footer">
          <ColorModeToggle />
          <Link className={isActive("/account") ? "account-link active" : "account-link"} href="/account"><UserRoundCog />Mi cuenta</Link>
          <div className="signed-in-user">
            <strong>{currentUser.name}</strong>
            <span>{currentUser.role === "ADMIN" ? "Administrador" : "Miembro"}</span>
          </div>
          <form action={logoutAction}>
            <button className="button sidebar-signout" type="submit"><ChevronLeft />Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="main">{children}</main>
    </div>
  );
}
