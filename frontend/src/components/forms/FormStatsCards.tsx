'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Smartphone, Clock, CheckCircle, XCircle } from 'lucide-react';

interface FormStatsCardsProps {
  stats: {
    total: number;
    pending: number;
    approved: number;
    rejected: number;
    panel_placement?: number;
    repairs?: number;
    panel_seaming?: number;
    non_destructive?: number;
    trial_weld?: number;
    destructive?: number;
  };
}

export default function FormStatsCards({ stats }: FormStatsCardsProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Total Forms</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stats.total || 0}</p>
            </div>
            <Smartphone className="h-8 w-8 text-blue-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pending Review</p>
              <p className="text-2xl font-bold text-yellow-600 mt-1">{stats.pending || 0}</p>
            </div>
            <Clock className="h-8 w-8 text-yellow-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Approved</p>
              <p className="text-2xl font-bold text-green-600 mt-1">{stats.approved || 0}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Rejected</p>
              <p className="text-2xl font-bold text-red-600 mt-1">{stats.rejected || 0}</p>
            </div>
            <XCircle className="h-8 w-8 text-red-600" />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

