<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\User;
use App\Models\AuditEvent;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;

class UserController extends Controller
{
    public function index()
    {
        return User::with('role')->orderBy('name')->paginate(50);
    }

    public function store(Request $request)
    {
        $data = $request->validate([
            'name'     => 'required|string|max:150',
            'email'    => 'required|email|unique:users,email',
            'phone'    => 'nullable|string|max:20',
            'password' => 'required|string|min:8',
            'role_id'  => 'required|exists:roles,id',
        ]);

        $user = User::create([
            'name'      => $data['name'],
            'email'     => $data['email'],
            'phone'     => $data['phone'] ?? null,
            'password'  => Hash::make($data['password']),
            'role_id'   => $data['role_id'],
            'is_active' => true,
        ]);

        AuditEvent::log('user', 'create', $user, null, $request->user());

        return response()->json($user->load('role'), 201);
    }

    public function show(User $user)
    {
        return $user->load('role');
    }

    public function update(Request $request, User $user)
    {
        $data = $request->validate([
            'name'      => 'sometimes|string|max:150',
            'phone'     => 'nullable|string|max:20',
            'role_id'   => 'sometimes|exists:roles,id',
            'is_active' => 'sometimes|boolean',
            'password'  => 'nullable|string|min:8',
        ]);

        if (isset($data['password'])) {
            $data['password'] = Hash::make($data['password']);
        } else {
            unset($data['password']);
        }

        // Prevent self-deactivation
        if ($request->user()->id === $user->id && isset($data['is_active']) && !$data['is_active']) {
            return response()->json(['message' => 'Cannot deactivate your own account.'], 422);
        }

        $user->update($data);
        AuditEvent::log('user', 'update', $user, null, $request->user());

        return $user->load('role');
    }

    public function deactivate(Request $request, User $user)
    {
        if ($request->user()->id === $user->id) {
            return response()->json(['message' => 'Cannot deactivate your own account.'], 422);
        }

        $user->update(['is_active' => false]);
        $user->tokens()->delete();

        AuditEvent::log('user', 'deactivate', $user, $request->input('reason'), $request->user());

        return response()->json(['message' => 'User deactivated.']);
    }
}
