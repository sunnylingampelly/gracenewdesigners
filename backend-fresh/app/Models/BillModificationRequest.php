<?php
namespace App\Models;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class BillModificationRequest extends Model {
    protected $fillable = ['bill_id','requested_by','reason','status','reviewed_by','admin_notes'];

    public function bill():     BelongsTo { return $this->belongsTo(SalesBill::class, 'bill_id'); }
    public function requester():BelongsTo { return $this->belongsTo(User::class, 'requested_by'); }
    public function reviewer(): BelongsTo { return $this->belongsTo(User::class, 'reviewed_by'); }
}
