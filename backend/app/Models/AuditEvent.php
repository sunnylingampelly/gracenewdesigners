<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class AuditEvent extends Model
{
    public $timestamps = false;
    protected $fillable = [
        'user_id', 'module', 'action', 'record_type', 'record_id',
        'before', 'after', 'reason', 'ip_address', 'user_agent',
    ];
    protected $casts = ['before' => 'array', 'after' => 'array', 'created_at' => 'datetime'];

    public function user() { return $this->belongsTo(User::class); }

    public static function log(string $module, string $action, $record = null, array $extra = []): void
    {
        static::create([
            'user_id'     => auth()->id(),
            'module'      => $module,
            'action'      => $action,
            'record_type' => $record ? get_class($record) : null,
            'record_id'   => $record?->id,
            'before'      => $extra['before'] ?? null,
            'after'       => $extra['after'] ?? null,
            'reason'      => $extra['reason'] ?? null,
            'ip_address'  => request()->ip(),
            'user_agent'  => request()->userAgent(),
            'created_at'  => now(),
        ]);
    }
}
