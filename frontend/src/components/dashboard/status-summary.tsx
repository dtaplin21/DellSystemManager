'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { fetchProjectStats } from '@/lib/api';
import { useToast } from '@/hooks/use-toast';

interface ProjectStats {
  total: number;
  active: number;
  completed: number;
  onHold: number;
  overdue: number;
}

export default function StatusSummary() {
  const [stats, setStats] = useState<ProjectStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    const loadStats = async () => {
      try {
        setIsLoading(true);
        const data = await fetchProjectStats();
        setStats(data);
      } catch (error) {
        toast({
          title: 'Error',
          description: 'Failed to load project statistics. Please try again.',
          variant: 'destructive',
        });
      } finally {
        setIsLoading(false);
      }
    };

    loadStats();
  }, [toast]);

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        {[...Array(5)].map((_, index) => (
          <Card key={index}>
            <CardContent className="p-4 flex justify-center items-center h-24">
              <div className="h-4 w-24 bg-gray-200 rounded animate-pulse"></div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  if (!stats) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
      <Card>
        <CardContent className="p-4 flex flex-col justify-center items-center h-24">
          <div className="text-3xl font-bold text-gray-900">{stats.total}</div>
          <div className="text-sm text-gray-500">Total Projects</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 flex flex-col justify-center items-center h-24">
          <div className="text-3xl font-bold text-green-600">{stats.active}</div>
          <div className="text-sm text-gray-500">Active Projects</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 flex flex-col justify-center items-center h-24">
          <div className="text-3xl font-bold text-blue-600">{stats.completed}</div>
          <div className="text-sm text-gray-500">Completed</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 flex flex-col justify-center items-center h-24">
          <div className="text-3xl font-bold text-yellow-600">{stats.onHold}</div>
          <div className="text-sm text-gray-500">On Hold</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardContent className="p-4 flex flex-col justify-center items-center h-24">
          <div className="text-3xl font-bold text-red-600">{stats.overdue}</div>
          <div className="text-sm text-gray-500">Overdue Tasks</div>
        </CardContent>
      </Card>
    </div>
  );
}
