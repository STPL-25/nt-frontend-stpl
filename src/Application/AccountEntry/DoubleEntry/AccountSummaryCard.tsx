import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { BookOpen, TrendingUp, TrendingDown, Scale } from 'lucide-react';
import type { JournalEntry } from './types';
import { formatINR } from './helpers';

interface AccountSummaryCardProps {
  entries: JournalEntry[];
}

const AccountSummaryCard: React.FC<AccountSummaryCardProps> = ({ entries }) => {
  const posted = entries.filter(e => e.status === 'Posted');
  const drafts = entries.filter(e => e.status === 'Draft');
  const totalDebits  = posted.reduce((s, e) => s + e.total_debit, 0);
  const totalCredits = posted.reduce((s, e) => s + e.total_credit, 0);

  const stats = [
    {
      icon: BookOpen,
      label: 'Total Entries',
      value: entries.length,
      sub: `${posted.length} posted · ${drafts.length} draft`,
      color: 'text-indigo-600',
      bg: 'bg-indigo-50',
    },
    {
      icon: TrendingUp,
      label: 'Total Debits (Posted)',
      value: formatINR(totalDebits),
      sub: 'Sum of all posted debit lines',
      color: 'text-green-600',
      bg: 'bg-green-50',
    },
    {
      icon: TrendingDown,
      label: 'Total Credits (Posted)',
      value: formatINR(totalCredits),
      sub: 'Sum of all posted credit lines',
      color: 'text-red-600',
      bg: 'bg-red-50',
    },
    {
      icon: Scale,
      label: 'Balance Check',
      value: Math.abs(totalDebits - totalCredits) < 0.01 ? 'Balanced' : `Off by ${formatINR(Math.abs(totalDebits - totalCredits))}`,
      sub: 'Debit vs Credit parity',
      color: Math.abs(totalDebits - totalCredits) < 0.01 ? 'text-green-600' : 'text-red-600',
      bg: Math.abs(totalDebits - totalCredits) < 0.01 ? 'bg-green-50' : 'bg-red-50',
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {stats.map(stat => {
        const Icon = stat.icon;
        return (
          <Card key={stat.label} className="border shadow-sm">
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="min-w-0">
                  <p className="text-xs text-gray-500 font-medium">{stat.label}</p>
                  <p className={`text-lg font-bold mt-0.5 truncate ${stat.color}`}>{stat.value}</p>
                  <p className="text-xs text-gray-400 mt-0.5">{stat.sub}</p>
                </div>
                <div className={`${stat.bg} p-2 rounded-lg shrink-0 ml-2`}>
                  <Icon size={17} className={stat.color} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default AccountSummaryCard;
