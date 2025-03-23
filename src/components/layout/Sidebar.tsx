import React from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  HomeIcon,
  CalendarIcon,
  ChartBarIcon,
  CogIcon,
  PencilIcon,
  Cog6ToothIcon,
  EnvelopeIcon,
  BellIcon,
} from '@heroicons/react/24/outline';

const navigation = [
  { name: 'Dashboard', href: '/', icon: HomeIcon },
  { name: 'Posts', href: '/posts', icon: PencilIcon },
  {
    name: 'Analytics',
    href: '/analytics',
    icon: ChartBarIcon,
    children: [
      { name: 'Overview', href: '/analytics' },
      { name: 'Email Performance', href: '/analytics/email', icon: EnvelopeIcon },
      { name: 'Monitoring', href: '/analytics/monitoring', icon: BellIcon },
      { name: 'Schedules', href: '/analytics/schedules' },
      { name: 'Templates', href: '/analytics/templates' },
    ]
  },
  { name: 'Schedule', href: '/schedule', icon: CalendarIcon },
  { name: 'Settings', href: '/settings', icon: Cog6ToothIcon },
];

export default function Sidebar() {
  const router = useRouter();

  return (
    <div className="w-64 bg-white shadow-lg">
      <div className="h-full px-3 py-4">
        <nav className="space-y-1">
          {navigation.map((item) => {
            const isActive = router.pathname === item.href;
            return (
              <Link
                key={item.name}
                href={item.href}
                className={`flex items-center px-2 py-2 text-sm font-medium rounded-md ${
                  isActive
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`}
              >
                <item.icon
                  className={`mr-3 flex-shrink-0 h-6 w-6 ${
                    isActive ? 'text-blue-700' : 'text-gray-400'
                  }`}
                  aria-hidden="true"
                />
                {item.name}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
} 