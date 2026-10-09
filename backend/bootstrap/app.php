<?php

use App\Http\Middleware\EnsurePermission;
use App\Http\Middleware\EnsureTwoFactorEnrolled;
use App\Http\Middleware\SecurityHeaders;
use Illuminate\Auth\Access\AuthorizationException;
use Illuminate\Database\Eloquent\ModelNotFoundException;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Request;
use Symfony\Component\HttpKernel\Exception\NotFoundHttpException;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        // Cookie-based Sanctum SPA authentication for the admin (requests proxied through the Next.js origin).
        $middleware->statefulApi();
        // Anonymous, session-free public writes (rate-limited, honeypot-protected). Admin routes keep CSRF.
        $middleware->validateCsrfTokens(except: [
            'api/v1/enquiries', 'api/v1/enquiries/*', 'api/v1/newsletter', 'api/v1/newsletter/*', 'api/v1/analytics/events',
        ]);
        $middleware->trustProxies(at: env('TRUSTED_PROXIES', '127.0.0.1'));
        $middleware->append(SecurityHeaders::class);
        $middleware->alias([
            'permission' => EnsurePermission::class,
            'mfa.enrolled' => EnsureTwoFactorEnrolled::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        $exceptions->shouldRenderJsonWhen(
            fn (Request $request) => $request->is('api/*') || $request->expectsJson(),
        );
        // Never reveal model class names or ids in 404s.
        $exceptions->render(function (NotFoundHttpException $e, Request $request) {
            if ($request->is('api/*') && $e->getPrevious() instanceof ModelNotFoundException) {
                return response()->json(['message' => 'Not found.'], 404);
            }
        });
        $exceptions->render(function (AuthorizationException $e, Request $request) {
            if ($request->is('api/*')) {
                return response()->json(['message' => 'You do not have permission to perform this action.'], 403);
            }
        });
    })->create();
