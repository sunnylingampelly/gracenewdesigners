<?php

namespace App\Console\Commands;

use App\Models\AnalyticsEvent;
use App\Services\Settings\SettingsService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('analytics:prune')]
#[Description('Delete first-party analytics events older than the retention period')]
class PruneAnalytics extends Command
{
    public function handle(SettingsService $settings): int
    {
        $days = (int) $settings->get('analytics_retention_days', 395);
        $deleted = AnalyticsEvent::query()->where('occurred_at', '<', now()->subDays($days))->delete();
        $this->info("Pruned {$deleted} analytics event(s).");

        return self::SUCCESS;
    }
}
