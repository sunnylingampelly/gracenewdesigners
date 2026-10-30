<?php
namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\SoftDeletes;

class Product extends Model
{
    use HasFactory, SoftDeletes;

    protected $fillable = [
        'category_id', 'collection_id', 'created_by', 'name', 'slug',
        'description', 'fabric', 'craftsmanship', 'care_notes',
        'occasion', 'fit', 'status', 'show_price',
    ];

    protected $casts = ['show_price' => 'boolean'];

    public function category()   { return $this->belongsTo(Category::class); }
    public function collection() { return $this->belongsTo(Collection::class); }
    public function creator()    { return $this->belongsTo(User::class, 'created_by'); }
    public function images()     { return $this->hasMany(ProductImage::class)->orderBy('sort_order'); }
    public function variants()   { return $this->hasMany(ProductVariant::class); }

    public function primaryImage()
    {
        return $this->hasOne(ProductImage::class)->where('is_primary', true);
    }

    public function scopePublished($query)
    {
        return $query->where('status', 'published');
    }
}
