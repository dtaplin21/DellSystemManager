'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Search, Filter } from 'lucide-react';

interface FormFiltersProps {
  filters: {
    domain: string;
    search: string;
  };
  onFiltersChange: (filters: { domain: string; search: string }) => void;
}

const FORM_DOMAINS = [
  { value: 'all', label: 'All Types' },
  { value: 'panel_placement', label: 'Panel Placement' },
  { value: 'repairs', label: 'Repairs' },
  { value: 'panel_seaming', label: 'Panel Seaming' },
  { value: 'non_destructive', label: 'Non-Destructive' },
  { value: 'trial_weld', label: 'Trial Weld' },
  { value: 'destructive', label: 'Destructive' }
];

export default function FormFilters({ filters, onFiltersChange }: FormFiltersProps) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Search by panel number, repair ID, etc..."
                value={filters.search}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          <div className="sm:w-48">
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <select
                value={filters.domain}
                onChange={(e) => onFiltersChange({ ...filters, domain: e.target.value })}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent appearance-none"
              >
                {FORM_DOMAINS.map((domain) => (
                  <option key={domain.value} value={domain.value}>
                    {domain.label}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

