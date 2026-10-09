<?php

namespace App\Support;

/**
 * Short-lived HMAC tokens that let an authorized admin preview drafts on the storefront
 * without exposing drafts to the public API.
 */
final class PreviewToken
{
    public static function issue(string $scope, int $userId, int $ttlMinutes = 60): string
    {
        $payload = rtrim(strtr(base64_encode(json_encode([
            's' => $scope, 'u' => $userId, 'e' => now()->addMinutes($ttlMinutes)->getTimestamp(),
        ])), '+/', '-_'), '=');

        return $payload.'.'.self::sign($payload);
    }

    /** Returns true when the token is authentic, unexpired and covers $scope (or the wildcard scope "*"). */
    public static function verify(?string $token, string $scope): bool
    {
        if (! $token || ! str_contains($token, '.')) {
            return false;
        }
        [$payload, $signature] = explode('.', $token, 2);
        if (! hash_equals(self::sign($payload), $signature)) {
            return false;
        }
        $data = json_decode(base64_decode(strtr($payload, '-_', '+/')), true);

        return is_array($data)
            && ($data['e'] ?? 0) >= now()->getTimestamp()
            && in_array($data['s'] ?? null, [$scope, '*'], true);
    }

    private static function sign(string $payload): string
    {
        return hash_hmac('sha256', 'preview|'.$payload, config('app.key'));
    }
}
