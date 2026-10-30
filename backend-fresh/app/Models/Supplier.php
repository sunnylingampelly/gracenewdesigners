<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Supplier extends Model
{
    use SoftDeletes;

    protected $fillable = [
        'name', 'contact_name', 'phone', 'email',
        'address', 'gstin', 'notes', 'payment_terms',
    ];

    public function purchases()
    {
        return $this->hasMany(Purchase::class);
    }
}
