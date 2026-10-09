<?php

namespace App\Policies;

use App\Models\User;

class UserPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('users.manage');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('users.manage');
    }

    /** Only owners may modify other owners. */
    public function update(User $user, User $target): bool
    {
        if (! $user->hasPermission('users.manage')) {
            return false;
        }

        return ! $target->isOwner() || $user->isOwner();
    }

    /** Nobody can delete themselves, and only owners can remove owners. */
    public function delete(User $user, User $target): bool
    {
        return $user->id !== $target->id && $this->update($user, $target);
    }
}
