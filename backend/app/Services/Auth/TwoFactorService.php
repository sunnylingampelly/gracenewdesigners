<?php

namespace App\Services\Auth;

use App\Models\User;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;
use PragmaRX\Google2FA\Google2FA;

/**
 * TOTP (RFC 6238) two-factor authentication with single-use recovery codes.
 * Secrets and recovery codes are stored encrypted (see User casts).
 */
class TwoFactorService
{
    public function __construct(private readonly Google2FA $google2fa = new Google2FA) {}

    /** @return array{secret: string, otpauth_url: string} */
    public function beginEnrollment(User $user): array
    {
        $secret = $this->google2fa->generateSecretKey(32);
        $user->forceFill(['two_factor_secret' => $secret, 'two_factor_confirmed_at' => null])->save();

        return [
            'secret' => $secret,
            'otpauth_url' => $this->google2fa->getQRCodeUrl(config('app.name'), $user->email, $secret),
        ];
    }

    /** @return list<string> recovery codes, shown once */
    public function confirmEnrollment(User $user, string $code): array
    {
        if (! $user->two_factor_secret || ! $this->google2fa->verifyKey($user->two_factor_secret, $code, 1)) {
            throw ValidationException::withMessages(['code' => 'The code is invalid. Check your authenticator app and try again.']);
        }
        $codes = collect(range(1, 8))->map(fn () => Str::lower(Str::random(5).'-'.Str::random(5)))->all();
        $user->forceFill([
            'two_factor_confirmed_at' => now(),
            'two_factor_recovery_codes' => array_map(fn ($c) => hash('sha256', $c), $codes),
        ])->save();

        return $codes;
    }

    public function verifyOrConsumeRecoveryCode(User $user, string $code): bool
    {
        $code = trim($code);
        if (preg_match('/^\d{6}$/', $code)) {
            return (bool) $this->google2fa->verifyKey($user->two_factor_secret, $code, 1);
        }

        $hashes = $user->two_factor_recovery_codes ?? [];
        $hash = hash('sha256', Str::lower($code));
        if (in_array($hash, $hashes, true)) {
            $user->forceFill(['two_factor_recovery_codes' => array_values(array_diff($hashes, [$hash]))])->save();

            return true;
        }

        return false;
    }

    public function disable(User $user): void
    {
        $user->forceFill([
            'two_factor_secret' => null,
            'two_factor_recovery_codes' => null,
            'two_factor_confirmed_at' => null,
        ])->save();
    }
}
