import { Link, useLocation } from "react-router-dom";

function normalizeRole(role) {
    return String(role || "").replace("ROLE_", "").toUpperCase();
}

function getPrimaryNav(role) {
    const normalized = normalizeRole(role);

    if (normalized.includes("ADMIN")) {
        return { label: "Dashboard", to: "/dashboard" };
    }

    if (normalized.includes("TECHNICIAN")) {
        return { label: "Technician", to: "/techhome" };
    }

    return { label: "Home", to: "/home" };
}

function getLinkClass(baseClass, isActive) {
    return isActive ? `${baseClass} active` : baseClass;
}

export default function RoleNavbar({ role }) {
    const location = useLocation();
    const primaryNav = getPrimaryNav(role);

    const primaryActive = location.pathname === primaryNav.to;
    const profileActive = location.pathname === "/profile";
    const settingsActive = location.pathname === "/settings";

    return (
        <nav className="role-navbar" aria-label="Primary navigation">
            <Link className={getLinkClass("nav-link", primaryActive)} to={primaryNav.to}>
                {primaryNav.label}
            </Link>
            <Link className={getLinkClass("nav-link", profileActive)} to="/profile">
                Profile
            </Link>
            <Link className={getLinkClass("nav-link", settingsActive)} to="/settings">
                Settings
            </Link>
        </nav>
    );
}
