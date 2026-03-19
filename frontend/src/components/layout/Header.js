import React, { useEffect, useState } from "react";
import PropTypes from "prop-types";
import {
  Search,
  Command,
} from "lucide-react";
import { useApp } from "../../contexts/AppContext";
import CommandCenter from "../common/CommandCenter";
import NotificationsPanel from "../common/NotificationsPanel";

const Header = ({ user }) => {
  const { t } = useApp();
  const [showCommandCenter, setShowCommandCenter] = useState(false);

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setShowCommandCenter(true);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, []);

  return (
    <>
      <header className="border-b border-slate-200 bg-white/95 px-4 py-3 backdrop-blur md:px-6">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 flex-1 items-center gap-3">
            <div className="relative w-full max-w-xl">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder={t("common.search")}
                className="h-10 w-full rounded-xl border border-slate-200 bg-slate-50 pl-10 pr-20 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
                onClick={() => setShowCommandCenter(true)}
                readOnly
              />
              <div className="absolute right-3 top-1/2 flex -translate-y-1/2 items-center gap-1 text-xs text-slate-400">
                <Command className="h-3 w-3" />
                <span>K</span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <NotificationsPanel user={user} />
          </div>
        </div>
      </header>

      <CommandCenter isOpen={showCommandCenter} onClose={() => setShowCommandCenter(false)} />
    </>
  );
};

Header.propTypes = {
  user: PropTypes.shape({
    firstName: PropTypes.string,
    lastName: PropTypes.string,
    email: PropTypes.string,
    roles: PropTypes.arrayOf(PropTypes.oneOfType([PropTypes.string, PropTypes.object])),
    permissions: PropTypes.arrayOf(PropTypes.string),
  }),
};

Header.defaultProps = {
  user: null,
};

export default Header;
