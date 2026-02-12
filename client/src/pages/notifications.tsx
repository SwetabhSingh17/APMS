import { useState } from "react";
import { useAuth } from "@/hooks/use-auth";
import MainLayout from "@/components/layout/main-layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Bell, CheckCheck, Search, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

type Notification = {
  id: number;
  title: string;
  message: string;
  timestamp: Date;
  read: boolean;
  type: 'info' | 'warning' | 'success' | 'error';
};

export default function Notifications() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [searchQuery, setSearchQuery] = useState("");
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

  const markAllAsRead = () => {
    setNotifications(prevNotifications =>
      prevNotifications.map(notification => ({
        ...notification,
        read: true
      }))
    );
    toast({
      title: "Notifications marked as read",
      description: "All notifications have been marked as read.",
    });
  };

  const markAsRead = (id: number) => {
    setNotifications(prevNotifications =>
      prevNotifications.map(notification =>
        notification.id === id
          ? { ...notification, read: true }
          : notification
      )
    );
  };

  const clearAllNotifications = () => {
    setNotifications([]);
    toast({
      title: "Notifications cleared",
      description: "All notifications have been cleared.",
    });
  };

  const formatDate = (date: Date) => {
    return new Intl.DateTimeFormat('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: 'numeric',
      hour12: true
    }).format(date);
  };

  const getNotificationIcon = (type: Notification['type']) => {
    switch (type) {
      case 'info':
        return <Bell className="w-4 h-4 text-blue-500" />;
      case 'warning':
        return <Bell className="w-4 h-4 text-yellow-500" />;
      case 'success':
        return <Bell className="w-4 h-4 text-green-500" />;
      case 'error':
        return <Bell className="w-4 h-4 text-red-500" />;
    }
  };

  const filteredNotifications = notifications
    .filter(notification => {
      if (filter === 'unread') return !notification.read;
      return true;
    })
    .filter(notification => {
      if (!searchQuery) return true;
      const query = searchQuery.toLowerCase();
      return (
        notification.title.toLowerCase().includes(query) ||
        notification.message.toLowerCase().includes(query)
      );
    });

  const unreadCount = notifications.filter(n => !n.read).length;

  if (!user) {
    return (
      <MainLayout>
        <div className="flex items-center justify-center h-full">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Not Authenticated</CardTitle>
              <CardDescription>
                You need to be logged in to view notifications.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground mb-1">Notifications</h1>
        <p className="text-muted-foreground">View and manage your notifications</p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>All Notifications</CardTitle>
              <CardDescription>
                You have {unreadCount} unread notifications
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={markAllAsRead}
                disabled={unreadCount === 0}
              >
                <CheckCheck className="w-4 h-4 mr-2" />
                Mark all read
              </Button>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={clearAllNotifications}
                disabled={notifications.length === 0}
              >
                <Trash2 className="w-4 h-4 mr-2" />
                Clear all
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground h-4 w-4" />
              <Input
                placeholder="Search notifications..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
            <Select value={filter} onValueChange={(value: 'all' | 'unread') => setFilter(value)}>
              <SelectTrigger className="w-40">
                <SelectValue placeholder="Filter notifications" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All</SelectItem>
                <SelectItem value="unread">Unread</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            {filteredNotifications.map((notification) => (
              <div
                key={notification.id}
                className={`flex items-start gap-4 p-4 rounded-lg transition-colors cursor-pointer hover:bg-accent/50 ${
                  notification.read ? 'opacity-70 bg-background' : 'bg-accent'
                }`}
                onClick={() => markAsRead(notification.id)}
              >
                <div className="mt-1">{getNotificationIcon(notification.type)}</div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium text-sm">{notification.title}</p>
                      <p className="text-sm text-muted-foreground">{notification.message}</p>
                    </div>
                    <span className="text-xs text-muted-foreground whitespace-nowrap">
                      {formatDate(notification.timestamp)}
                    </span>
                  </div>
                </div>
              </div>
            ))}

            {filteredNotifications.length === 0 && (
              <div className="text-center py-8 text-muted-foreground">
                No notifications found
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </MainLayout>
  );
} 