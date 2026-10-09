<?php

namespace App\Providers;

use App\Models\Category;
use App\Models\Collection;
use App\Models\Customer;
use App\Models\Department;
use App\Models\Enquiry;
use App\Models\Lookbook;
use App\Models\MediaAsset;
use App\Models\NavigationItem;
use App\Models\Occasion;
use App\Models\Order;
use App\Models\Page;
use App\Models\Product;
use App\Models\Setting;
use App\Models\Testimonial;
use App\Models\User;
use App\Policies\CustomerPolicy;
use App\Policies\EnquiryPolicy;
use App\Policies\MediaAssetPolicy;
use App\Policies\OrderPolicy;
use App\Policies\ProductPolicy;
use App\Policies\UserPolicy;
use App\Services\Content\HomepageService;
use App\Services\Search\DatabaseSearchEngine;
use App\Services\Search\SearchEngine;
use App\Services\StorefrontRevalidator;
use Illuminate\Auth\Notifications\ResetPassword;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Gate;
use Illuminate\Support\Facades\RateLimiter;
use Illuminate\Support\ServiceProvider;
use Illuminate\Validation\Rules\Password;

class AppServiceProvider extends ServiceProvider
{
    public function register(): void
    {
        // Swap for a Meilisearch-backed engine without changing callers.
        $this->app->singleton(SearchEngine::class, DatabaseSearchEngine::class);
        $this->app->singleton(StorefrontRevalidator::class);
    }

    public function boot(): void
    {
        // N+1 guard: fails tests outright, and logs (rather than breaks) in local development.
        Model::preventLazyLoading(! $this->app->isProduction());
        if (! $this->app->runningUnitTests()) {
            Model::handleLazyLoadingViolationUsing(fn (Model $model, string $relation) => logger()->warning(
                'Lazy loading '.$model::class."::{$relation}"
            ));
        }
        Model::preventSilentlyDiscardingAttributes(! $this->app->isProduction());

        Password::defaults(fn () => Password::min(12)->letters()->mixedCase()->numbers()->symbols()
            ->when($this->app->isProduction(), fn ($rule) => $rule->uncompromised()));

        Gate::policy(Product::class, ProductPolicy::class);
        Gate::policy(Enquiry::class, EnquiryPolicy::class);
        Gate::policy(Order::class, OrderPolicy::class);
        Gate::policy(MediaAsset::class, MediaAssetPolicy::class);
        Gate::policy(Customer::class, CustomerPolicy::class);
        Gate::policy(User::class, UserPolicy::class);

        ResetPassword::createUrlUsing(fn (User $user, string $token) => rtrim(config('app.frontend_url'), '/')
            .'/admin/reset-password?token='.$token.'&email='.urlencode($user->email));

        $this->configureRateLimiting();

        // Catalogue changes invalidate cached storefront aggregates.
        foreach ([
            Product::class, Category::class, Collection::class, Occasion::class, Department::class, Page::class,
            Lookbook::class, NavigationItem::class, Setting::class, Testimonial::class,
        ] as $model) {
            $model::saved(fn () => $this->flushStorefrontCaches());
            $model::deleted(fn () => $this->flushStorefrontCaches());
        }
    }

    private function flushStorefrontCaches(): void
    {
        Cache::forget(HomepageService::CACHE_KEY);
        Cache::forget('storefront.navigation.v1');
        DatabaseSearchEngine::flushVocabulary();
        $this->app->make(StorefrontRevalidator::class)->revalidate();
    }

    private function configureRateLimiting(): void
    {
        RateLimiter::for('api', fn (Request $request) => Limit::perMinute(240)->by($request->user()?->id ?: $request->ip()));
        RateLimiter::for('search', fn (Request $request) => Limit::perMinute(90)->by($request->ip()));
        RateLimiter::for('enquiries', fn (Request $request) => [
            Limit::perMinute(8)->by('enq-min:'.$request->ip()),
            Limit::perHour(60)->by('enq-hour:'.$request->ip()),
        ]);
        RateLimiter::for('forms', fn (Request $request) => Limit::perMinute(5)->by($request->ip()));
        RateLimiter::for('analytics', fn (Request $request) => Limit::perMinute(120)->by($request->ip()));
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(5)->by('login:'.mb_strtolower((string) $request->input('email')).'|'.$request->ip()),
            Limit::perMinute(20)->by('login-ip:'.$request->ip()),
        ]);
    }
}
