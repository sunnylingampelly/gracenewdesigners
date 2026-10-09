<?php

namespace App\Policies;

use App\Models\Customer;
use App\Models\User;

class CustomerPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('customers.view');
    }

    public function view(User $user, Customer $customer): bool
    {
        return $user->hasPermission('customers.view');
    }

    public function update(User $user, Customer $customer): bool
    {
        return $user->hasPermission('customers.manage');
    }

    public function anonymize(User $user, Customer $customer): bool
    {
        return $user->hasPermission('customers.manage');
    }

    public function delete(User $user, Customer $customer): bool
    {
        return $user->hasPermission('customers.manage');
    }
}
