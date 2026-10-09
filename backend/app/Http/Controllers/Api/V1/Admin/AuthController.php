<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Http\Controllers\Controller;
use App\Http\Resources\Admin\CurrentUserResource;
use App\Models\User;
use App\Services\ActivityLogger;
use App\Services\Auth\TwoFactorService;
use Illuminate\Auth\Events\PasswordReset;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Password;
use Illuminate\Support\Str;
use Illuminate\Validation\Rules\Password as PasswordRule;
use Illuminate\Validation\ValidationException;

/**
 * Session (cookie) authentication for the admin SPA via Sanctum, with optional/mandatory TOTP.
 */
class AuthController extends Controller
{
    public function __construct(
        private readonly TwoFactorService $twoFactor,
        private readonly ActivityLogger $logger,
    ) {}

    public function login(Request $request): JsonResponse
    {
        $credentials = $request->validate([
            'email' => ['required', 'email'],
            'password' => ['required', 'string'],
            'remember' => ['nullable', 'boolean'],
        ]);

        $user = User::query()->where('email', Str::lower($credentials['email']))->first();
        // Uniform error regardless of which part failed (no account enumeration).
        if (! $user || ! $user->is_active || ! Hash::check($credentials['password'], $user->password)) {
            throw ValidationException::withMessages(['email' => 'These credentials do not match our records.']);
        }

        if ($user->hasTwoFactorEnabled()) {
            $request->session()->put('auth.2fa', [
                'user_id' => $user->id,
                'remember' => (bool) ($credentials['remember'] ?? false),
                'expires_at' => now()->addMinutes(5)->getTimestamp(),
            ]);

            return response()->json(['data' => ['two_factor_required' => true]]);
        }

        return $this->completeLogin($request, $user, (bool) ($credentials['remember'] ?? false));
    }

    public function twoFactorChallenge(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'string', 'max:32']]);
        $pending = $request->session()->get('auth.2fa');
        if (! $pending || $pending['expires_at'] < now()->getTimestamp()) {
            $request->session()->forget('auth.2fa');
            throw ValidationException::withMessages(['code' => 'Your sign-in session expired. Please sign in again.']);
        }

        $user = User::query()->findOrFail($pending['user_id']);
        if (! $this->twoFactor->verifyOrConsumeRecoveryCode($user, $data['code'])) {
            throw ValidationException::withMessages(['code' => 'The code is invalid. Please try again.']);
        }
        $request->session()->forget('auth.2fa');

        return $this->completeLogin($request, $user, $pending['remember']);
    }

    private function completeLogin(Request $request, User $user, bool $remember): JsonResponse
    {
        Auth::guard('web')->login($user, $remember);
        $request->session()->regenerate();
        $user->forceFill([
            'last_login_at' => now(),
            'last_login_ip_hash' => hash('sha256', $request->ip().config('app.key')),
        ])->save();
        $this->logger->log('auth.login', "{$user->name} signed in", $user);

        return response()->json(['data' => new CurrentUserResource($user->load('roles.permissions'))]);
    }

    public function logout(Request $request): JsonResponse
    {
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return response()->json(null, 204);
    }

    public function me(Request $request): JsonResponse
    {
        return response()->json(['data' => new CurrentUserResource($request->user()->load('roles.permissions'))]);
    }

    public function forgotPassword(Request $request): JsonResponse
    {
        $request->validate(['email' => ['required', 'email']]);
        Password::sendResetLink(['email' => Str::lower($request->input('email'))]);

        // Same response whether or not the address exists.
        return response()->json(['data' => ['message' => 'If an account exists for that address, a reset link has been sent.']]);
    }

    public function resetPassword(Request $request): JsonResponse
    {
        $request->validate([
            'token' => ['required', 'string'],
            'email' => ['required', 'email'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);

        $status = Password::reset(
            $request->only('email', 'password', 'password_confirmation', 'token'),
            function (User $user, string $password) {
                $user->forceFill(['password' => $password, 'remember_token' => Str::random(60)])->save();
                event(new PasswordReset($user));
            }
        );

        if ($status !== Password::PASSWORD_RESET) {
            throw ValidationException::withMessages(['email' => 'This reset link is invalid or has expired.']);
        }

        return response()->json(['data' => ['message' => 'Your password has been reset. You can now sign in.']]);
    }

    public function changePassword(Request $request): JsonResponse
    {
        $request->validate([
            'current_password' => ['required', 'current_password'],
            'password' => ['required', 'confirmed', PasswordRule::defaults()],
        ]);
        $request->user()->forceFill(['password' => $request->input('password')])->save();
        $this->logger->log('auth.password_changed', 'Changed own password', $request->user());

        return response()->json(['data' => ['message' => 'Password updated.']]);
    }

    public function twoFactorSetup(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user->hasTwoFactorEnabled()) {
            throw ValidationException::withMessages(['code' => 'Two-factor authentication is already enabled.']);
        }

        return response()->json(['data' => $this->twoFactor->beginEnrollment($user)]);
    }

    public function twoFactorConfirm(Request $request): JsonResponse
    {
        $data = $request->validate(['code' => ['required', 'digits:6']]);
        $codes = $this->twoFactor->confirmEnrollment($request->user(), $data['code']);
        $this->logger->log('auth.2fa_enabled', 'Enabled two-factor authentication', $request->user());

        return response()->json(['data' => ['recovery_codes' => $codes]]);
    }

    public function twoFactorDisable(Request $request): JsonResponse
    {
        $request->validate(['current_password' => ['required', 'current_password']]);
        $user = $request->user();
        if ($user->requiresTwoFactor()) {
            throw ValidationException::withMessages(['current_password' => 'Your role requires two-factor authentication.']);
        }
        $this->twoFactor->disable($user);
        $this->logger->log('auth.2fa_disabled', 'Disabled two-factor authentication', $user);

        return response()->json(null, 204);
    }
}
