<?php

use App\Console\Commands\PruneAnalytics;
use App\Console\Commands\PublishScheduledProducts;
use App\Console\Commands\PurgeExpiredEnquiryData;
use App\Console\Commands\SendFollowUpDigest;
use Illuminate\Support\Facades\Schedule;

$tz = config('app.operations_timezone');

Schedule::command(PublishScheduledProducts::class)->everyMinute()->withoutOverlapping();
Schedule::command(SendFollowUpDigest::class)->dailyAt('09:00')->timezone($tz);
Schedule::command(PurgeExpiredEnquiryData::class)->dailyAt('03:30')->timezone($tz);
Schedule::command(PruneAnalytics::class)->weeklyOn(1, '04:00')->timezone($tz);
Schedule::command('queue:prune-failed --hours=720')->daily();
