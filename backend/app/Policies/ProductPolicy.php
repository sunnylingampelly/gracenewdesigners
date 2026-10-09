<?php

namespace App\Policies;

use App\Models\Product;
use App\Models\User;

class ProductPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('products.view');
    }

    public function view(User $user, Product $product): bool
    {
        return $user->hasPermission('products.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('products.manage');
    }

    public function update(User $user, Product $product): bool
    {
        return $user->hasPermission('products.manage');
    }

    public function duplicate(User $user, Product $product): bool
    {
        return $user->hasPermission('products.manage');
    }

    public function publish(User $user, Product $product): bool
    {
        return $user->hasPermission('products.publish');
    }

    public function delete(User $user, Product $product): bool
    {
        return $user->hasPermission('products.publish');
    }

    public function restore(User $user, Product $product): bool
    {
        return $user->hasPermission('products.publish');
    }

    public function import(User $user): bool
    {
        return $user->hasPermission('products.import');
    }

    public function export(User $user): bool
    {
        return $user->hasPermission('products.import');
    }
}
