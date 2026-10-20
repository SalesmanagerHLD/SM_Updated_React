import { useState } from "react";
import type { MouseEvent } from "react";
import { Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  AppBar,
  Badge,
  Box,
  Chip,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  Menu,
  MenuItem,
  Stack,
  Toolbar,
  Typography,
  Button,
  useMediaQuery,
} from "@mui/material";
import { useTheme } from "@mui/material/styles";
import DashboardIcon from "@mui/icons-material/Dashboard";
import LogoutIcon from "@mui/icons-material/Logout";
import MenuIcon from "@mui/icons-material/Menu";
import TuneIcon from "@mui/icons-material/Tune";
import PeopleIcon from "@mui/icons-material/People";
import AccountTreeIcon from "@mui/icons-material/AccountTree";
import GroupsIcon from "@mui/icons-material/Groups";
import AssignmentIcon from "@mui/icons-material/Assignment";
import HistoryIcon from "@mui/icons-material/History";
import BarChartIcon from "@mui/icons-material/BarChart";
import NotificationsIcon from "@mui/icons-material/Notifications";
import SettingsIcon from "@mui/icons-material/Settings";
import BeachAccessIcon from "@mui/icons-material/BeachAccess";
import FactCheckIcon from "@mui/icons-material/FactCheck";
import AccessTimeIcon from "@mui/icons-material/AccessTime";
import EventBusyIcon from "@mui/icons-material/EventBusy";
import CalendarMonthIcon from "@mui/icons-material/CalendarMonth";
import CalendarViewMonthIcon from "@mui/icons-material/CalendarViewMonth";
import SpaceDashboardIcon from "@mui/icons-material/SpaceDashboard";
import Inventory2Icon from "@mui/icons-material/Inventory2";
import ReceiptLongIcon from "@mui/icons-material/ReceiptLong";
import ContactsIcon from "@mui/icons-material/Contacts";
import RequestQuoteIcon from "@mui/icons-material/RequestQuote";
import dayjs from "dayjs";
import { useAuth } from "../auth/AuthContext";
import { useEntitlements } from "../entitlement/EntitlementContext";
import type { Notification } from "../api/notificationsApi";
import {
  useMarkNotificationRead,
  useNotifications,
  useUnreadNotificationCount,
} from "../api/notificationsApi";
import {
  NOTIFICATION_TYPE_COLORS,
  NOTIFICATION_TYPE_ICONS,
  describeNotification,
  getNotificationTarget,
  isNotificationVisible,
} from "../utils/notificationFormat";
import { TypeIconAvatar } from "./TypeIconAvatar";

const DRAWER_WIDTH = 220;

/** Small static (non-sticky) group label between nav sections - plain List has no built-in grouping otherwise. */
function NavSectionHeader({ label }: { label: string }) {
  return (
    <ListSubheader
      disableSticky
      sx={{
        lineHeight: "30px",
        fontSize: "0.625rem",
        fontWeight: 600,
        letterSpacing: "0.06em",
        textTransform: "uppercase",
        bgcolor: "transparent",
      }}
    >
      {label}
    </ListSubheader>
  );
}

/**
 * Authenticated app shell: an AppBar (title, logged-in user, logout) plus a simple
 * sidebar with only the one destination that exists so far. New sections
 * (leads/visits/employees/masters/settings) will get their own nav items and
 * routes in later phases.
 */
export function Layout() {
  const { email, role, logout } = useAuth();
  const { hasEntitlement } = useEntitlements();
  const hasLeaveManagement = hasEntitlement("EMPLOYEE_LEAVE_MANAGEMENT");
  const hasTeamVisibility = hasEntitlement("TEAM_VISIBILITY");
  const hasInventoryManagement = hasEntitlement("INVENTORY_MANAGEMENT");
  const navigate = useNavigate();
  const location = useLocation();
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down("md"));

  const [notifAnchorEl, setNotifAnchorEl] = useState<HTMLElement | null>(null);
  const notifMenuOpen = Boolean(notifAnchorEl);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Top 10 in the dropdown - "See all" below links to the full /app/notifications page for
  // anything beyond that.
  const { data: notificationsPage } = useNotifications(false, { size: 10 });
  const markReadMutation = useMarkNotificationRead();
  // The badge's source of truth is a dedicated count endpoint, not "how many unread items
  // happen to be in the last 10 fetched" - see useUnreadNotificationCount's own comment.
  const { data: unreadCount = 0 } = useUnreadNotificationCount();

  // A notification whose feature has since been un-licensed has nowhere valid to navigate to
  // anymore - hide it rather than show a dead link (see isNotificationVisible's own comment).
  const notifications = (notificationsPage?.content ?? []).filter((n) =>
    isNotificationVisible(n, hasEntitlement),
  );

  const handleLogout = async () => {
    await logout();
    navigate("/login", { replace: true });
  };

  const handleToggleMobileNav = () => {
    setMobileNavOpen((prev) => !prev);
  };

  const handleCloseMobileNav = () => {
    setMobileNavOpen(false);
  };

  /** Navigates to the destination and, on mobile, closes the temporary drawer
   * so it doesn't stay open over the newly-navigated page. */
  const handleNavigate = (path: string) => {
    navigate(path);
    handleCloseMobileNav();
  };

  const handleOpenNotifications = (event: MouseEvent<HTMLElement>) => {
    setNotifAnchorEl(event.currentTarget);
  };

  const handleCloseNotifications = () => {
    setNotifAnchorEl(null);
  };

  const handleNotificationClick = (notification: Notification) => {
    if (!notification.isRead) {
      markReadMutation.mutate(notification.id);
    }
    handleCloseNotifications();
    const target = getNotificationTarget(notification);
    if (target) {
      navigate(target);
    }
  };

  const handleSeeAllNotifications = () => {
    handleCloseNotifications();
    navigate("/app/notifications");
  };

  const navList = (
    <List>
      <ListItemButton
        selected={location.pathname === "/app"}
        onClick={() => handleNavigate("/app")}
      >
        <ListItemIcon>
          <DashboardIcon />
        </ListItemIcon>
        <ListItemText primary="Dashboard" />
      </ListItemButton>

      <NavSectionHeader label="Sales" />

      <ListItemButton
        selected={location.pathname.startsWith("/app/leads")}
        onClick={() => handleNavigate("/app/leads")}
      >
        <ListItemIcon>
          <AssignmentIcon />
        </ListItemIcon>
        <ListItemText primary="Leads" />
      </ListItemButton>

      <ListItemButton
        selected={location.pathname.startsWith("/app/activity")}
        onClick={() => handleNavigate("/app/activity")}
      >
        <ListItemIcon>
          <HistoryIcon />
        </ListItemIcon>
        <ListItemText primary="Activity" />
      </ListItemButton>

      <ListItemButton
        selected={location.pathname.startsWith("/app/notifications")}
        onClick={() => handleNavigate("/app/notifications")}
      >
        <ListItemIcon>
          <Badge badgeContent={unreadCount} color="error" max={99}>
            <NotificationsIcon />
          </Badge>
        </ListItemIcon>
        <ListItemText primary="Notifications" />
      </ListItemButton>

      <ListItemButton
        selected={location.pathname.startsWith("/app/my-team")}
        onClick={() => handleNavigate("/app/my-team")}
      >
        <ListItemIcon>
          <GroupsIcon />
        </ListItemIcon>
        <ListItemText primary="My Team" />
      </ListItemButton>

      {/* ADMINs already get a "Reports" item in the Administration section below - this is
          only for a non-admin manager reaching it via TEAM_VISIBILITY (see TeamVisibilityRoute). */}
      {role !== "ADMIN" && hasTeamVisibility && (
        <ListItemButton
          selected={location.pathname.startsWith("/app/reports")}
          onClick={() => handleNavigate("/app/reports")}
        >
          <ListItemIcon>
            <BarChartIcon />
          </ListItemIcon>
          <ListItemText primary="Reports" />
        </ListItemButton>
      )}

      {hasLeaveManagement && (
        <>
          <NavSectionHeader label="Leave & Attendance" />

          <ListItemButton
            selected={location.pathname === "/app/leave"}
            onClick={() => handleNavigate("/app/leave")}
          >
            <ListItemIcon>
              <BeachAccessIcon />
            </ListItemIcon>
            <ListItemText primary="My Leave" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname.startsWith("/app/leave/approvals")}
            onClick={() => handleNavigate("/app/leave/approvals")}
          >
            <ListItemIcon>
              <FactCheckIcon />
            </ListItemIcon>
            <ListItemText primary="Leave Approvals" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname.startsWith("/app/leave/attendance")}
            onClick={() => handleNavigate("/app/leave/attendance")}
          >
            <ListItemIcon>
              <AccessTimeIcon />
            </ListItemIcon>
            <ListItemText primary="My Attendance" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname.startsWith("/app/leave/team-calendar")}
            onClick={() => handleNavigate("/app/leave/team-calendar")}
          >
            <ListItemIcon>
              <CalendarViewMonthIcon />
            </ListItemIcon>
            <ListItemText primary="Team Calendar" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname.startsWith("/app/leave/hr-dashboard")}
            onClick={() => handleNavigate("/app/leave/hr-dashboard")}
          >
            <ListItemIcon>
              <SpaceDashboardIcon />
            </ListItemIcon>
            <ListItemText primary="HR Dashboard" />
          </ListItemButton>
        </>
      )}

      {hasInventoryManagement && (
        <>
          <NavSectionHeader label="Inventory" />

          <ListItemButton
            selected={location.pathname.startsWith("/app/customers")}
            onClick={() => handleNavigate("/app/customers")}
          >
            <ListItemIcon>
              <ContactsIcon />
            </ListItemIcon>
            <ListItemText primary="Customers" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname.startsWith("/app/inventory/products")}
            onClick={() => handleNavigate("/app/inventory/products")}
          >
            <ListItemIcon>
              <Inventory2Icon />
            </ListItemIcon>
            <ListItemText primary="Products" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname.startsWith("/app/quotations")}
            onClick={() => handleNavigate("/app/quotations")}
          >
            <ListItemIcon>
              <RequestQuoteIcon />
            </ListItemIcon>
            <ListItemText primary="Quotations" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname.startsWith("/app/invoices")}
            onClick={() => handleNavigate("/app/invoices")}
          >
            <ListItemIcon>
              <ReceiptLongIcon />
            </ListItemIcon>
            <ListItemText primary="Invoices" />
          </ListItemButton>
        </>
      )}

      {role === "ADMIN" && (
        <>
          <NavSectionHeader label="Administration" />

          <ListItemButton
            selected={location.pathname.startsWith("/app/masters")}
            onClick={() => handleNavigate("/app/masters")}
          >
            <ListItemIcon>
              <TuneIcon />
            </ListItemIcon>
            <ListItemText primary="Masters" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname === "/app/employees"}
            onClick={() => handleNavigate("/app/employees")}
          >
            <ListItemIcon>
              <PeopleIcon />
            </ListItemIcon>
            <ListItemText primary="Employees" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname.startsWith("/app/employees/org-chart")}
            onClick={() => handleNavigate("/app/employees/org-chart")}
          >
            <ListItemIcon>
              <AccountTreeIcon />
            </ListItemIcon>
            <ListItemText primary="Org Structure" />
          </ListItemButton>

          <ListItemButton
            selected={location.pathname.startsWith("/app/reports")}
            onClick={() => handleNavigate("/app/reports")}
          >
            <ListItemIcon>
              <BarChartIcon />
            </ListItemIcon>
            <ListItemText primary="Reports" />
          </ListItemButton>

          {hasLeaveManagement && (
            <>
              <ListItemButton
                selected={location.pathname.startsWith("/app/leave/types")}
                onClick={() => handleNavigate("/app/leave/types")}
              >
                <ListItemIcon>
                  <EventBusyIcon />
                </ListItemIcon>
                <ListItemText primary="Leave Types" />
              </ListItemButton>

              <ListItemButton
                selected={location.pathname.startsWith("/app/leave/holidays")}
                onClick={() => handleNavigate("/app/leave/holidays")}
              >
                <ListItemIcon>
                  <CalendarMonthIcon />
                </ListItemIcon>
                <ListItemText primary="Holidays" />
              </ListItemButton>
            </>
          )}
        </>
      )}

      <Divider sx={{ my: 1 }} />

      <ListItemButton
        selected={location.pathname.startsWith("/app/settings")}
        onClick={() => handleNavigate("/app/settings")}
      >
        <ListItemIcon>
          <SettingsIcon />
        </ListItemIcon>
        <ListItemText primary="Settings" />
      </ListItemButton>
    </List>
  );

  return (
    <Box sx={{ display: "flex" }}>
      <AppBar position="fixed" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar sx={{ gap: { xs: 1, sm: 2 } }}>
          {isMobile && (
            <IconButton
              color="inherit"
              edge="start"
              onClick={handleToggleMobileNav}
              aria-label="Open navigation menu"
            >
              <MenuIcon />
            </IconButton>
          )}
          <Typography variant="h6" noWrap component="div" sx={{ flexGrow: 1 }}>
            {isMobile ? "SalesManager" : "SalesManager CRM"}
          </Typography>
          {email && (
            <Typography
              variant="body2"
              color="text.secondary"
              noWrap
              sx={{ display: { xs: "none", sm: "block" } }}
            >
              {email}
            </Typography>
          )}
          {role && (
            <Chip
              label={role}
              size="small"
              color="primary"
              variant="outlined"
              sx={{ fontWeight: 500, fontSize: "0.7rem" }}
            />
          )}
          <IconButton color="inherit" onClick={handleOpenNotifications}>
            <Badge badgeContent={unreadCount} color="error">
              <NotificationsIcon />
            </Badge>
          </IconButton>
          <Menu
            anchorEl={notifAnchorEl}
            open={notifMenuOpen}
            onClose={handleCloseNotifications}
            anchorOrigin={{ vertical: "bottom", horizontal: "right" }}
            transformOrigin={{ vertical: "top", horizontal: "right" }}
            slotProps={{ paper: { sx: { width: 340, maxHeight: 420 } } }}
          >
            {notifications.length === 0 && (
              <MenuItem disabled>No notifications yet</MenuItem>
            )}
            {notifications.flatMap((notification, index) => {
              const items = [];
              if (index > 0) {
                items.push(<Divider key={`${notification.id}-divider`} />);
              }
              items.push(
                <MenuItem
                  key={notification.id}
                  onClick={() => handleNotificationClick(notification)}
                  sx={{
                    whiteSpace: "normal",
                    alignItems: "flex-start",
                    py: 1.5,
                    gap: 1.25,
                    bgcolor: notification.isRead ? "transparent" : "action.selected",
                    opacity: notification.isRead ? 0.6 : 1,
                  }}
                >
                  <TypeIconAvatar
                    icon={NOTIFICATION_TYPE_ICONS[notification.type]}
                    color={NOTIFICATION_TYPE_COLORS[notification.type]}
                    size={32}
                    muted={notification.isRead}
                  />
                  <Box sx={{ minWidth: 0, flexGrow: 1 }}>
                    <Stack direction="row" sx={{ alignItems: "flex-start", justifyContent: "space-between", gap: 1 }}>
                      <Typography
                        variant="body2"
                        sx={{ fontWeight: notification.isRead ? 400 : 700 }}
                      >
                        {describeNotification(notification)}
                      </Typography>
                      {/* Unread dot - a clearer at-a-glance signal than the background tint alone. */}
                      {!notification.isRead && (
                        <Box
                          sx={{
                            width: 8,
                            height: 8,
                            borderRadius: "50%",
                            mt: 0.75,
                            flexShrink: 0,
                            bgcolor: "error.main",
                          }}
                        />
                      )}
                    </Stack>
                    <Typography variant="caption" color="text.secondary">
                      {dayjs(notification.createdAt).format("DD MMM YYYY, HH:mm")}
                    </Typography>
                  </Box>
                </MenuItem>,
              );
              return items;
            })}
            <Divider />
            <MenuItem onClick={handleSeeAllNotifications} sx={{ justifyContent: "center" }}>
              <Typography variant="body2" color="primary">
                See all notifications
              </Typography>
            </MenuItem>
          </Menu>
          {isMobile ? (
            <IconButton
              color="inherit"
              onClick={handleLogout}
              aria-label="Logout"
            >
              <LogoutIcon />
            </IconButton>
          ) : (
            <Button
              color="inherit"
              size="small"
              startIcon={<LogoutIcon fontSize="small" />}
              onClick={handleLogout}
              sx={{ color: "text.secondary" }}
            >
              Logout
            </Button>
          )}
        </Toolbar>
      </AppBar>

      {isMobile ? (
        <Drawer
          variant="temporary"
          open={mobileNavOpen}
          onClose={handleCloseMobileNav}
          ModalProps={{ keepMounted: true }}
          sx={{
            [`& .MuiDrawer-paper`]: {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
            },
          }}
        >
          <Toolbar />
          {navList}
        </Drawer>
      ) : (
        <Drawer
          variant="permanent"
          sx={{
            width: DRAWER_WIDTH,
            flexShrink: 0,
            [`& .MuiDrawer-paper`]: {
              width: DRAWER_WIDTH,
              boxSizing: "border-box",
            },
          }}
        >
          <Toolbar />
          {navList}
        </Drawer>
      )}

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { xs: "100%", md: `calc(100% - ${DRAWER_WIDTH}px)` },
        }}
      >
        <Toolbar />
        <Box sx={{ flex: 1, minHeight: 0, overflowY: "auto", p: 3 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
          // The window never scrolls: main is exactly one screen tall. List pages fill the area
          // below (PageFill) so only their table scrolls; every other page scrolls inside it.
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
