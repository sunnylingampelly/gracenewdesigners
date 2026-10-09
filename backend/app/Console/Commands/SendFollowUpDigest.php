<?php

namespace App\Console\Commands;

use App\Enums\EnquiryStatus;
use App\Models\Enquiry;
use App\Models\User;
use App\Notifications\FollowUpDigestNotification;
use Illuminate\Console\Attributes\Description;
use Illuminate\Console\Attributes\Signature;
use Illuminate\Console\Command;

#[Signature('enquiries:follow-up-digest')]
#[Description('Email each team member a digest of their overdue and due-today follow-ups')]
class SendFollowUpDigest extends Command
{
    public function handle(): int
    {
        $open = array_map(fn ($s) => $s->value, EnquiryStatus::open());
        $due = Enquiry::query()->whereIn('status', $open)->whereNotNull('assigned_to')
            ->where('follow_up_at', '<=', now()->endOfDay())->get()->groupBy('assigned_to');

        $sent = 0;
        foreach ($due as $userId => $enquiries) {
            $user = User::query()->where('is_active', true)->find($userId);
            if ($user) {
                $user->notify(new FollowUpDigestNotification($enquiries->pluck('reference')->all()));
                $sent++;
            }
        }
        $this->info("Sent {$sent} follow-up digest(s).");

        return self::SUCCESS;
    }
}
