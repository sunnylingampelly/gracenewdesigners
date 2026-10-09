<?php

namespace App\Console\Commands;

use App\Models\Customer;
use App\Models\Enquiry;
use App\Services\Settings\SettingsService;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

/**
 * Data retention: after the configured period, personal details on closed enquiries are erased.
 * Customers with no recent enquiries or orders are anonymized. Catalogue snapshots are kept for reporting.
 */
#[Signature('privacy:purge-enquiries {--dry-run}')]
#[Description('Erase personal data from enquiries older than the retention period')]
class PurgeExpiredEnquiryData extends Command
{
    public function handle(SettingsService $settings): int
    {
        $months = (int) $settings->get('enquiry_retention_months', 24);
        $cutoff = now()->subMonths($months);

        $enquiries = Enquiry::query()->where('created_at', '<', $cutoff)
            ->where(fn ($q) => $q->whereNotNull('customer_message')->orWhereNotNull('measurements')->orWhereNotNull('ip_hash'));
        $customers = Customer::query()->whereNull('anonymized_at')
            ->whereDoesntHave('enquiries', fn ($q) => $q->where('created_at', '>=', $cutoff))
            ->whereDoesntHave('orders', fn ($q) => $q->where('created_at', '>=', $cutoff));

        $this->info(sprintf('%d enquiries and %d customers past the %d-month retention period.', $enquiries->count(), $customers->count(), $months));
        if ($this->option('dry-run')) {
            return self::SUCCESS;
        }

        $enquiries->update(['customer_message' => null, 'measurements' => null, 'ip_hash' => null]);
        $customers->each(fn (Customer $c) => $c->anonymize());

        return self::SUCCESS;
    }
}
