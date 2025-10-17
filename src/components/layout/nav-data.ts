import {
  AlarmClock,
  Bell,
  CalendarClock,
  CalendarRange,
  ClipboardList,
  FileText,
  Gift,
  Home,
  Inbox,
  ListTodo,
  NotebookPen,
  Paperclip,
  Settings,
  ShoppingCart,
  ShieldCheck,
  Trophy,
  UtensilsCrossed,
  Wallet,
  Waves,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  description?: string;
};

export const primaryNav: NavItem[] = [
  {
    name: "Dashboard",
    href: "/dashboard",
    icon: Home,
    description: "Overview of what is next",
  },
  {
    name: "Calendar",
    href: "/calendar",
    icon: CalendarRange,
    description: "Household schedule and events",
  },
  {
    name: "Meal Planner",
    href: "/meal-planner",
    icon: UtensilsCrossed,
    description: "Plan meals and prep",
  },
  {
    name: "Shopping Lists",
    href: "/shopping-lists",
    icon: ShoppingCart,
    description: "Groceries and errands",
  },
  {
    name: "Planner",
    href: "/planner",
    icon: NotebookPen,
    description: "Tasks and upcoming planning",
  },
  {
    name: "Quiet Hours",
    href: "/quiet-hours",
    icon: Waves,
    description: "Notification quiet time",
  },
];

export const moreNav: NavItem[] = [
  {
    name: "Events",
    href: "/calendar/events",
    icon: CalendarClock,
  },
  {
    name: "Planner Templates",
    href: "/planner/templates",
    icon: ClipboardList,
  },
  {
    name: "Goals",
    href: "/planner/goals",
    icon: ListTodo,
  },
  {
    name: "Reports",
    href: "/reports",
    icon: FileText,
  },
  {
    name: "Rewards",
    href: "/rewards",
    icon: Gift,
  },
  {
    name: "Settings",
    href: "/settings/plan",
    icon: Settings,
  },
  {
    name: "Notifications",
    href: "/notifications",
    icon: Bell,
  },
  {
    name: "Reminders",
    href: "/reminders",
    icon: AlarmClock,
  },
  {
    name: "Attachments",
    href: "/attachments",
    icon: Paperclip,
  },
  {
    name: "Finance",
    href: "/finance",
    icon: Wallet,
  },
  {
    name: "Security",
    href: "/security",
    icon: ShieldCheck,
  },
  {
    name: "Leaderboard",
    href: "/leaderboard",
    icon: Trophy,
  },
  {
    name: "Inbox",
    href: "/inbox",
    icon: Inbox,
  },
];
