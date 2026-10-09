<?php

namespace App\Services\Content;

use App\Enums\SectionType;
use App\Models\HomepageSection;
use App\Services\ActivityLogger;
use App\Services\StorefrontRevalidator;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\DB;

/**
 * Draft/publish workflow for the homepage builder. Admin edits only touch draft_* columns;
 * publish() promotes all drafts at once so the live homepage changes atomically.
 */
class HomepageService
{
    public const CACHE_KEY = 'homepage.live.v1';

    public function __construct(
        private readonly SectionHydrator $hydrator,
        private readonly ActivityLogger $logger,
    ) {}

    public function create(SectionType $type, string $name, array $config, array $schedule = []): HomepageSection
    {
        $config = SectionSchema::validate($type, $config + SectionSchema::defaults($type));
        $next = (int) HomepageSection::query()->max('draft_sort_order') + 1;

        $section = HomepageSection::query()->create([
            'type' => $type,
            'name' => $name,
            'draft_config' => $config,
            'draft_sort_order' => $next,
            'draft_is_enabled' => true,
            'starts_at' => $schedule['starts_at'] ?? null,
            'ends_at' => $schedule['ends_at'] ?? null,
            'updated_by' => Auth::id(),
        ]);
        $this->logger->log('homepage.section_created', "Added homepage section “{$name}” (draft)", $section);

        return $section;
    }

    public function update(HomepageSection $section, array $data): HomepageSection
    {
        if (array_key_exists('config', $data)) {
            $section->draft_config = SectionSchema::validate($section->type, $data['config']);
        }
        if (array_key_exists('name', $data)) {
            $section->name = $data['name'];
        }
        if (array_key_exists('is_enabled', $data)) {
            $section->draft_is_enabled = (bool) $data['is_enabled'];
        }
        // Scheduling applies immediately: the live query honours the window, so it is safe to change.
        foreach (['starts_at', 'ends_at'] as $key) {
            if (array_key_exists($key, $data)) {
                $section->{$key} = $data[$key];
            }
        }
        $section->updated_by = Auth::id();
        $section->save();
        $this->flush();

        return $section;
    }

    /** @param list<int> $orderedIds */
    public function reorder(array $orderedIds): void
    {
        DB::transaction(function () use ($orderedIds) {
            foreach (array_values($orderedIds) as $position => $id) {
                HomepageSection::query()->whereKey($id)->update(['draft_sort_order' => $position + 1]);
            }
        });
    }

    public function remove(HomepageSection $section): void
    {
        if ($section->is_published) {
            $section->update(['pending_removal' => true]);
        } else {
            $section->delete();
        }
    }

    public function restore(HomepageSection $section): void
    {
        $section->update(['pending_removal' => false]);
    }

    /** Promote every draft to live in one transaction. */
    public function publish(): int
    {
        $count = DB::transaction(function () {
            HomepageSection::query()->where('pending_removal', true)->delete();
            $sections = HomepageSection::query()->get();
            foreach ($sections as $section) {
                $section->forceFill([
                    'config' => $section->draft_config,
                    'sort_order' => $section->draft_sort_order,
                    'is_enabled' => $section->draft_is_enabled,
                    'is_published' => true,
                    'published_at' => now(),
                ])->save();
            }

            return $sections->count();
        });

        $this->flush();
        app(StorefrontRevalidator::class)->revalidate();
        $this->logger->log('homepage.published', "Published homepage ({$count} sections)");

        return $count;
    }

    /** Throw away unpublished edits and return every section to its live state. */
    public function discardDraft(): void
    {
        DB::transaction(function () {
            HomepageSection::query()->where('is_published', false)->delete();
            foreach (HomepageSection::query()->get() as $section) {
                $section->forceFill([
                    'draft_config' => $section->config,
                    'draft_sort_order' => $section->sort_order,
                    'draft_is_enabled' => $section->is_enabled,
                    'pending_removal' => false,
                ])->save();
            }
        });
        $this->logger->log('homepage.draft_discarded', 'Discarded unpublished homepage changes');
    }

    public function hasUnpublishedChanges(): bool
    {
        return HomepageSection::query()->get()->contains(fn (HomepageSection $s) => $s->hasUnpublishedChanges());
    }

    /** Live homepage payload for the storefront. */
    public function live(): array
    {
        return Cache::remember(self::CACHE_KEY, now()->addMinutes(10), function () {
            return HomepageSection::query()->live()->get()
                ->map(fn (HomepageSection $s) => $this->hydrator->hydrate($s->id, $s->type, $s->config ?? []))
                ->filter()->values()->all();
        });
    }

    /** Draft homepage payload for authorized previews. */
    public function preview(): array
    {
        return HomepageSection::query()
            ->where('draft_is_enabled', true)->where('pending_removal', false)
            ->orderBy('draft_sort_order')->get()
            ->map(fn (HomepageSection $s) => $this->hydrator->hydrate($s->id, $s->type, $s->draft_config ?? []))
            ->filter()->values()->all();
    }

    public function flush(): void
    {
        Cache::forget(self::CACHE_KEY);
    }
}
