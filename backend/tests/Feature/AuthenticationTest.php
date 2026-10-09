<?php

namespace Tests\Feature;

use App\Models\Role;
use App\Models\User;
use App\Notifications\AdminPasswordReset;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\Password;
use PragmaRX\Google2FA\Google2FA;
use Tests\TestCase;

class AuthenticationTest extends TestCase
{
    public function test_admin_can_sign_in_and_fetch_profile(): void
    {
        $user = $this->userWithRole('catalog-manager', ['email' => 'staff@example.com', 'password' => 'Correct-Horse-9!']);

        $this->postJson('/api/v1/admin/auth/login', ['email' => 'staff@example.com', 'password' => 'Correct-Horse-9!'])
            ->assertOk()
            ->assertJsonPath('data.email', 'staff@example.com')
            ->assertJsonPath('data.roles.0.slug', 'catalog-manager')
            ->assertJsonFragment(['products.manage']);

        $this->assertAuthenticatedAs($user);
        $this->getJson('/api/v1/admin/auth/me')->assertOk()->assertJsonPath('data.id', $user->id);
    }

    public function test_wrong_password_and_unknown_email_return_the_same_error(): void
    {
        $this->userWithRole('owner', ['email' => 'owner@example.com', 'password' => 'Correct-Horse-9!']);

        $wrong = $this->postJson('/api/v1/admin/auth/login', ['email' => 'owner@example.com', 'password' => 'nope'])->assertStatus(422);
        $unknown = $this->postJson('/api/v1/admin/auth/login', ['email' => 'ghost@example.com', 'password' => 'nope'])->assertStatus(422);

        $this->assertSame($wrong->json('errors.email'), $unknown->json('errors.email'));
        $this->assertGuest();
    }

    public function test_inactive_users_cannot_sign_in(): void
    {
        $this->userWithRole('owner', ['email' => 'former@example.com', 'password' => 'Correct-Horse-9!', 'is_active' => false]);

        $this->postJson('/api/v1/admin/auth/login', ['email' => 'former@example.com', 'password' => 'Correct-Horse-9!'])->assertStatus(422);
        $this->assertGuest();
    }

    public function test_login_is_throttled_after_repeated_failures(): void
    {
        $this->userWithRole('owner', ['email' => 'owner@example.com']);
        foreach (range(1, 5) as $_) {
            $this->postJson('/api/v1/admin/auth/login', ['email' => 'owner@example.com', 'password' => 'wrong'])->assertStatus(422);
        }
        $this->postJson('/api/v1/admin/auth/login', ['email' => 'owner@example.com', 'password' => 'wrong'])->assertStatus(429);
    }

    public function test_admin_endpoints_require_authentication(): void
    {
        $this->getJson('/api/v1/admin/auth/me')->assertUnauthorized();
        $this->getJson('/api/v1/admin/products')->assertUnauthorized();
        $this->getJson('/api/v1/admin/enquiries')->assertUnauthorized();
    }

    public function test_two_factor_enrollment_and_challenge(): void
    {
        $user = $this->userWithRole('owner', ['email' => 'owner@example.com', 'password' => 'Correct-Horse-9!']);
        $this->actingAs($user);

        $secret = $this->postJson('/api/v1/admin/auth/two-factor')->assertOk()->json('data.secret');
        $code = (new Google2FA)->getCurrentOtp($secret);
        $recovery = $this->postJson('/api/v1/admin/auth/two-factor/confirm', ['code' => $code])->assertOk()->json('data.recovery_codes');
        $this->assertCount(8, $recovery);
        $this->assertTrue($user->fresh()->hasTwoFactorEnabled());

        $this->postJson('/api/v1/admin/auth/logout')->assertNoContent();
        $this->app['auth']->forgetGuards();

        $this->postJson('/api/v1/admin/auth/login', ['email' => 'owner@example.com', 'password' => 'Correct-Horse-9!'])
            ->assertOk()->assertJsonPath('data.two_factor_required', true);
        $this->assertGuest();

        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['code' => '000000'])->assertStatus(422);
        // A recovery code works once.
        $this->postJson('/api/v1/admin/auth/two-factor-challenge', ['code' => $recovery[0]])->assertOk();
        $this->assertAuthenticatedAs($user);
        $this->assertCount(7, $user->fresh()->two_factor_recovery_codes);
    }

    public function test_roles_requiring_mfa_block_admin_api_until_enrolled(): void
    {
        Role::query()->where('slug', 'administrator')->update(['requires_mfa' => true]);
        $this->actingAsRole('administrator');

        $this->getJson('/api/v1/admin/products')->assertForbidden()->assertJsonPath('code', 'mfa_enrollment_required');
        $this->postJson('/api/v1/admin/auth/two-factor')->assertOk();
    }

    public function test_password_reset_link_and_reset(): void
    {
        Notification::fake();
        $user = $this->userWithRole('owner', ['email' => 'owner@example.com']);

        $this->postJson('/api/v1/admin/auth/forgot-password', ['email' => 'owner@example.com'])->assertOk();
        $this->postJson('/api/v1/admin/auth/forgot-password', ['email' => 'nobody@example.com'])->assertOk();
        Notification::assertSentTo($user, AdminPasswordReset::class);

        $token = Password::createToken($user);
        $this->postJson('/api/v1/admin/auth/reset-password', [
            'token' => $token, 'email' => 'owner@example.com',
            'password' => 'weak', 'password_confirmation' => 'weak',
        ])->assertStatus(422)->assertJsonValidationErrors('password');

        $this->postJson('/api/v1/admin/auth/reset-password', [
            'token' => $token, 'email' => 'owner@example.com',
            'password' => 'A-Much-Stronger-Pass-42!', 'password_confirmation' => 'A-Much-Stronger-Pass-42!',
        ])->assertOk();

        $this->assertTrue(Hash::check('A-Much-Stronger-Pass-42!', User::find($user->id)->password));
    }
}
