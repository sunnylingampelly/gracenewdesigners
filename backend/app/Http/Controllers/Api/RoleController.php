<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Role;
use App\Models\AuditEvent;
use Illuminate\Http\Request;

class RoleController extends Controller
{
    public function index()
    {
        return Role::withCount('users')->orderBy('name')->get();
    }

    public function show(Role $role)
    {
        return $role->load('users');
    }

    public function update(Request $request, Role $role)
    {
        if ($role->name === 'super_admin') {
            return response()->json(['message' => 'Super admin role cannot be modified.'], 403);
        }

        $data = $request->validate([
            'display_name' => 'sometimes|string|max:100',
            'permissions'  => 'sometimes|array',
            'permissions.*'=> 'string',
        ]);

        $role->update($data);
        AuditEvent::log('user', 'update_role', $role, null, $request->user());

        return $role;
    }
}
