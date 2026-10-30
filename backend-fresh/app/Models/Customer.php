<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Customer extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'created_by', 'name', 'phone', 'email', 'preferred_contact',
        'address', 'dob', 'notes', 'marketing_consent',
    ];

    protected $casts = ['dob' => 'date', 'marketing_consent' => 'boolean'];

    public function creator()  { return $this->belongsTo(User::class, 'created_by'); }
    public function leads()    { return $this->hasMany(Lead::class); }
    public function bills()    { return $this->hasMany(SalesBill::class); }
}
