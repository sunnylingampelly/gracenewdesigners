<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

/**
 * Blocks admin API access for users whose role mandates MFA until they have enrolled.
 * Enrollment endpoints themselves are excluded from this middleware.
 */
class EnsureTwoFactorEnrolled
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        if ($user && $user->requiresTwoFactor() && ! $user->hasTwoFactorEnabled()) {
            return response()->json([
                'message' => 'Two-factor authentication is required for your role. Please set it up to continue.',
                'code' => 'mfa_enrollment_required',
            ], 403);
        }

        return $next($request);
    }
}
