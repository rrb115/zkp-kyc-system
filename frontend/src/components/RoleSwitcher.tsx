'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

export function RoleSwitcher() {
  const pathname = usePathname();

  const roles = [
    { 
      path: '/', 
      name: 'User', 
      description: 'Generate proofs and manage credentials',
      color: 'bg-green-500 hover:bg-green-600',
      icon: '👤'
    },
    { 
      path: '/verifier', 
      name: 'Verifier', 
      description: 'Request age verifications from users',
      color: 'bg-orange-500 hover:bg-orange-600',
      icon: '🔍'
    },
    { 
      path: '/attester', 
      name: 'Attester', 
      description: 'Issue Aadhaar credentials to users',
      color: 'bg-blue-500 hover:bg-blue-600',
      icon: '🏛️'
    },
  ];

  return (
    <div className="bg-white p-6 rounded-lg shadow-md">
      <h2 className="text-xl font-bold mb-4 text-gray-800">Switch Role</h2>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {roles.map((role) => (
          <Link
            key={role.path}
            href={role.path}
            className={`
              p-4 rounded-lg border-2 transition-all duration-200 text-center
              ${pathname === role.path 
                ? 'border-blue-500 bg-blue-50 shadow-md' 
                : 'border-gray-200 hover:border-gray-300 hover:shadow-sm'
              }
            `}
          >
            <div className="text-2xl mb-2">{role.icon}</div>
            <h3 className={`font-bold mb-2 ${pathname === role.path ? 'text-blue-700' : 'text-gray-800'}`}>
              {role.name}
            </h3>
            <p className="text-sm text-gray-600">{role.description}</p>
            {pathname === role.path && (
              <div className="mt-2 text-xs text-blue-600 font-medium">Currently Active</div>
            )}
          </Link>
        ))}
      </div>
    </div>
  );
}
