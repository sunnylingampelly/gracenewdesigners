<?php

namespace App\Policies;

use App\Models\MediaAsset;
use App\Models\User;

class MediaAssetPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('media.view');
    }

    public function view(User $user, MediaAsset $mediaAsset): bool
    {
        return $user->hasPermission('media.view');
    }

    public function create(User $user): bool
    {
        return $user->hasPermission('media.manage');
    }

    public function update(User $user, MediaAsset $mediaAsset): bool
    {
        return $user->hasPermission('media.manage');
    }

    public function delete(User $user, MediaAsset $mediaAsset): bool
    {
        return $user->hasPermission('media.manage');
    }
}
