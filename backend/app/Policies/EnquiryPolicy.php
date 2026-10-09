<?php

namespace App\Policies;

use App\Models\Enquiry;
use App\Models\User;

class EnquiryPolicy
{
    public function viewAny(User $user): bool
    {
        return $user->hasPermission('enquiries.view');
    }

    public function view(User $user, Enquiry $enquiry): bool
    {
        return $user->hasPermission('enquiries.view');
    }

    public function update(User $user, Enquiry $enquiry): bool
    {
        return $user->hasPermission('enquiries.manage');
    }

    public function export(User $user): bool
    {
        return $user->hasPermission('enquiries.export');
    }

    public function delete(User $user, Enquiry $enquiry): bool
    {
        return $user->hasPermission('enquiries.manage');
    }
}
