<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class Collection extends Model
{
    protected $fillable = ['name', 'description', 'season', 'year', 'is_active'];

    public function products()
    {
        return $this->hasMany(Product::class);
    }
}
