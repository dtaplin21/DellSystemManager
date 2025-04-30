'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { fetchNotifications } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface Notification {
  id: string;
  message: string;
  type: string;
  relatedTo: string;
  relatedId: string;
  date: string;
  read: boolean;
}

export default function NotificationList() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();
  const { toast } = useToast();

  useEffect(() => {
    const loadNotifications = async () => {
      try {
        setIsLoading(true);
        const data = await fetchNotifications();
        setNotifications(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load notifications. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadNotifications();
  }, [toast]);

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <span className="text-yellow-500">⚠️</span>;
      case 'error':
        return <span className="text-red-500">❌</span>;
      case 'success':
        return <span className="text-green-500">✅</span>;
      default:
        return <span className="text-blue-500">ℹ️</span>;
    }
  };

  const handleNotificationClick = (notification: Notification) => {
    if (notification.relatedTo === 'project') {
      router.push(`/dashboard/projects/${notification.relatedId}`);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[...Array(3)].map((_, index) => (
          <div key={index} className="flex items-start space-x-3">
            <div className="h-5 w-5 bg-gray-200 rounded-full animate-pulse"></div>
            <div className="flex-1">
              <div className="h-4 w-full bg-gray-200 rounded animate-pulse mb-2"></div>
              <div className="h-3 w-24 bg-gray-200 rounded animate-pulse"></div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (notifications.length === 0) {
    return (
      <div className="text-center py-6 text-gray-500">
        No new notifications
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {notifications.map((notification) => (
        <div 
          key={notification.id}
          className={`flex items-start space-x-3 p-3 rounded-md cursor-pointer hover:bg-gray-50 ${!notification.read ? 'bg-blue-50' : ''}`}
          onClick={() => handleNotificationClick(notification)}
        >
          <div className="flex-shrink-0 mt-0.5">
            {getNotificationIcon(notification.type)}
          </div>
          <div className="flex-1">
            <p className={`text-sm ${!notification.read ? 'font-medium' : ''}`}>
              {notification.message}
            </p>
            <p className="text-xs text-gray-500 mt-1">
              {new Date(notification.date).toLocaleString()}
            </p>
          </div>
        </div>
      ))}
      
      <div className="text-center mt-4">
        <Button variant="ghost" size="sm">
          View All Notifications
        </Button>
      </div>
    </div>
  );
}
