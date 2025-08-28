// frontend/src/components/layout/Header.js
import React, { useEffect, useState } from 'react';
import PropTypes from 'prop-types';
import { useApp } from '../../contexts/AppContext';
import { useAuth } from '../../contexts/AuthContext';
import {
  Search, User, ChevronDown,
  Command, LogOut
} from 'lucide-react';
import { Button } from '../ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
  DropdownMenuSeparator
} from '../ui/dropdown-menu';
import CommandCenter from '../common/CommandCenter';

const Header = ({ user: propUser }) => {
  const { t } = useApp();
  const { user: authUser, logout } = useAuth();

  // Utilisateur (auth prioritaire)
  const user = authUser || propUser;

  // Command Center (Cmd/Ctrl+K)
  const [showCommandCenter, setShowCommandCenter] = useState(false);
  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setShowCommandCenter(true);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const handleLogout = () => { logout(); window.location.href = '/login'; };

  const displayName = user?.firstName
    ? `${user.firstName} ${user.lastName || ''}`.trim()
    : (user?.email || 'Utilisateur');
  const primaryRole = Array.isArray(user?.roles) ? user.roles[0] : (user?.role || 'Rôle');

  return (
    <>
      <header className="h-16 bg-white border-b border-gray-200 flex items-center justify-between px-6">
        {/* Recherche (ouvre CommandCenter) */}
        <div className="flex items-center gap-4 flex-1 max-w-lg">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder={t('common.search')}
              className="w-full pl-10 pr-20 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent"
              onClick={() => setShowCommandCenter(true)}
              readOnly
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1 text-xs text-gray-400">
              <Command className="w-3 h-3" />
              <span>K</span>
            </div>
          </div>
        </div>

        {/* Profil */}
        <div className="flex items-center gap-4">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-600 rounded-full flex items-center justify-center">
                  <User className="w-4 h-4 text-white" />
                </div>
                <div className="text-left">
                  <div className="text-sm font-medium">{displayName}</div>
                  <div className="text-xs text-gray-500">{primaryRole}</div>
                </div>
                <ChevronDown className="w-4 h-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <div className="px-2 py-1.5">
                <p className="text-sm font-medium">{displayName}</p>
                <p className="text-xs text-gray-500">{user?.email || '—'}</p>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem>{t('common.profile')}</DropdownMenuItem>
              <DropdownMenuItem>{t('common.settings')}</DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                className="text-red-600 focus:text-red-600"
                onClick={handleLogout}
              >
                <LogOut className="w-4 h-4 mr-2" />
                {t('common.logout')}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* Command Center */}
      <CommandCenter
        isOpen={showCommandCenter}
        onClose={() => setShowCommandCenter(false)}
      />
    </>
  );
};

Header.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    role: PropTypes.string,
    roles: PropTypes.arrayOf(PropTypes.string),
  }),
};

export default Header;
