<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Attributes\Fillable;
use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;

#[Fillable(['name', 'phone', 'email', 'city', 'country', 'notes', 'marketing_consent', 'marketing_consent_at'])]
class Customer extends Model
{
    use HasFactory, SoftDeletes;

    protected function casts(): array
    {
        return [
            'marketing_consent' => 'boolean',
            'marketing_consent_at' => 'datetime',
            'anonymized_at' => 'datetime',
        ];
    }

    public function enquiries(): HasMany
    {
        return $this->hasMany(Enquiry::class);
    }

    public function orders(): HasMany
    {
        return $this->hasMany(Order::class);
    }

    /** Remove personal data while keeping operational records intact (privacy request / retention). */
    public function anonymize(): void
    {
        $this->forceFill([
            'name' => null,
            'phone' => null,
            'email' => null,
            'city' => null,
            'notes' => null,
            'marketing_consent' => false,
            'anonymized_at' => now(),
        ])->save();

        $this->enquiries()->update(['customer_message' => null, 'measurements' => null]);
        $this->orders()->update([
            'shipping_name' => null, 'shipping_phone' => null, 'shipping_line1' => null, 'shipping_line2' => null,
            'shipping_postal_code' => null,
        ]);
    }
}
