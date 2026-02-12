import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useLocation } from "wouter";
import { useState } from "react";

type Notification = {
  id: number;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
};

export function NotificationDropdown() {
  const [, setLocation] = useLocation();
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: 1,
      title: "New Project Topic",
      message: "A new project topic has been submitted for approval",
      timestamp: new Date(Date.now() - 1000 * 60 * 30), // 30 minutes ago
      read: false,
      type: 'info'
    },
    {
      id: 2,
      title: "Topic Approved",
      message: "Your project topic 'AI-based Attendance System' has been approved",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2 hours ago
      read: false,
      type: 'success'
    },
    {
      id: 3,
      title: "Deadline Reminder",
      message: "Project milestone submission due in 2 days",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24), // 1 day ago
      read: true,
      type: 'warning'
    }
  ]);

  const markAsRead = (id: number) => {
    setNotifications(prevNotifications =>
      prevNotifications.map(notification =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  const formatTimeAgo = (date: Date) => {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
    
    if (diffInMinutes < 1) return 'just now';
    if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)}h ago`;
    return `${Math.floor(diffInMinutes / 1440)}d ago`;
  };

  const getNotificationStyles = (type: Notification['type'], read: boolean) => {
    const baseStyles = "flex flex-col gap-1 px-4 py-3 hover:bg-accent transition-colors cursor-pointer";
    const readStyles = read ? "opacity-70" : "";
    
    return `${baseStyles} ${readStyles}`;
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="w-6 h-6" />
          {unreadCount > 0 && (
            <span className="absolute top-0 right-0 w-2 h-2 bg-destructive rounded-full" />
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-80">
        <div className="font-semibold px-4 py-3 text-foreground flex items-center">
          Notifications
          {unreadCount > 0 && (
            <span className="ml-2 text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              {unreadCount} new
            </span>
          )}
        </div>
        <DropdownMenuSeparator />
        <ScrollArea className="h-[300px]">
          {notifications.length > 0 ? (
            notifications.map((notification) => (
              <DropdownMenuItem 
                key={notification.id} 
                className={getNotificationStyles(notification.type, notification.read)}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className="font-medium text-sm">{notification.title}</p>
                    <p className="text-sm text-muted-foreground">{notification.message}</p>
                  </div>
                  <span className="text-xs text-muted-foreground whitespace-nowrap">
                    {formatTimeAgo(notification.timestamp)}
                  </span>
                </div>
              </DropdownMenuItem>
            ))
          ) : (
            <div className="px-4 py-3 text-center text-muted-foreground">
              No notifications
            </div>
          )}
        </ScrollArea>
        <DropdownMenuSeparator />
        <div className="px-4 py-2">
          <Button 
            variant="ghost" 
            className="w-full text-sm" 
            size="sm"
            onClick={() => {
              setLocation('/notifications');
            }}
          >
            View all notifications
          </Button>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
} 