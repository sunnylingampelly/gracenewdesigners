<?php

namespace App\Services;

use App\Models\ActivityLog;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Request;

/**
 * Audit trail for administrative changes.
 */
class ActivityLogger
{
    /** Fields never written to the audit log. */
    private const REDACTED = ['password', 'remember_token', 'two_factor_secret', 'two_factor_recovery_codes', 'measurements'];

    public function log(string $action, string $description, ?Model $subject = null, ?array $changes = null): ActivityLog
    {
        return ActivityLog::query()->create([
            'user_id' => Auth::id(),
            'action' => $action,
            'subject_type' => $subject ? class_basename($subject) : null,
            'subject_id' => $subject?->getKey(),
            'description' => mb_substr($description, 0, 500),
            'changes' => $changes ? $this->redact($changes) : null,
            'ip_hash' => Request::ip() ? hash('sha256', Request::ip().config('app.key')) : null,
        ]);
    }

    /** Diff of dirty attributes captured before save. */
    public function diff(Model $model): array
    {
        $changes = [];
        foreach ($model->getDirty() as $key => $new) {
            if (in_array($key, ['updated_at', 'search_text'], true)) {
                continue;
            }
            $changes[$key] = ['from' => $model->getOriginal($key), 'to' => $new];
        }

        return $changes;
    }

    private function redact(array $changes): array
    {
        foreach (self::REDACTED as $key) {
            if (array_key_exists($key, $changes)) {
                $changes[$key] = '[redacted]';
            }
        }

        return array_map(function ($value) {
            if ($value instanceof \BackedEnum) {
                return $value->value;
            }
            if (is_array($value)) {
                return array_map(fn ($v) => $v instanceof \BackedEnum ? $v->value : $v, $value);
            }

            return $value;
        }, $changes);
    }
}
