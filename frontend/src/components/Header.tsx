// frontend/src/components/Header.tsx
'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface HeaderProps {
  title: string;
  role: string;
}

export function Header({ title, role }: HeaderProps) {
  const pathname = usePathname();

  const navItems = [
    { href: '/', label: 'User', role: 'User' },
    { href: '/verifier', label: 'Verifier', role: 'Verifier' },
    { href: '/attester', label: 'Attester', role: 'Attester' },
  ];

  return (
    <header className="bg-blue-600 text-white p-4 shadow-lg">
      <div className="container mx-auto flex justify-between items-center">
        <h1 className="text-2xl font-bold">{title}</h1>
        <div className="flex items-center space-x-6">
          {/* Role Navigation */}
          <nav className="flex space-x-1">
            {navItems.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  pathname === item.href || role === item.role
                    ? 'bg-blue-500 text-white'
                    : 'bg-transparent text-blue-100 hover:bg-blue-500 hover:text-white'
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          
          {/* Current Role Badge */}
          <div className="bg-blue-500 px-3 py-1 rounded-full text-sm font-medium">
            Current: {role}
          </div>
        </div>
      </div>
    </header>
  );
}