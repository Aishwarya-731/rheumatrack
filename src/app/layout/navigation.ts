import {
  BarChart3,
  ClipboardPlus,
  Crosshair,
  FileDown,
  History,
  LayoutDashboard,
  PersonStanding,
  Settings,
  Share2,
  Upload,
  Users,
  type LucideIcon,
} from 'lucide-react';
import type { Role } from '@/domain/types';

export interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
  end?: boolean;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const PATIENT_NAV: NavGroup[] = [
  {
    label: 'Overview',
    items: [
      { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/joints', label: 'Joints & ROM', icon: PersonStanding },
    ],
  },
  {
    label: 'Record',
    items: [
      { to: '/symptoms/new', label: 'Symptom check-in', icon: ClipboardPlus },
      { to: '/movement/import', label: 'Import movement', icon: Upload },
      { to: '/calibration', label: 'Calibration', icon: Crosshair },
      { to: '/history', label: 'History', icon: History },
    ],
  },
  {
    label: 'Analytics',
    items: [
      { to: '/analytics', label: 'Trends', icon: BarChart3 },
      { to: '/reports', label: 'Reports & export', icon: FileDown },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/sharing', label: 'Sharing', icon: Share2 },
      { to: '/settings', label: 'Settings', icon: Settings },
    ],
  },
];

export const CLINICIAN_NAV: NavGroup[] = [
  {
    label: 'Clinician',
    items: [{ to: '/clinician', label: 'Patients', icon: Users, end: true }],
  },
  {
    label: 'Account',
    items: [{ to: '/settings', label: 'Settings', icon: Settings }],
  },
];

export function navFor(role: Role): NavGroup[] {
  return role === 'clinician' ? CLINICIAN_NAV : PATIENT_NAV;
}

export const PAGE_TITLES: Array<{ match: RegExp; title: string }> = [
  { match: /^\/$/, title: 'Dashboard' },
  { match: /^\/joints/, title: 'Joints & ROM' },
  { match: /^\/symptoms/, title: 'Symptom check-in' },
  { match: /^\/movement/, title: 'Import movement' },
  { match: /^\/sessions/, title: 'Movement session' },
  { match: /^\/calibration/, title: 'Calibration' },
  { match: /^\/history/, title: 'History' },
  { match: /^\/analytics/, title: 'Trends' },
  { match: /^\/reports/, title: 'Reports & export' },
  { match: /^\/sharing/, title: 'Sharing' },
  { match: /^\/settings/, title: 'Settings' },
  { match: /^\/clinician/, title: 'Patients' },
];

