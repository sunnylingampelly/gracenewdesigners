<?php

namespace App\Http\Controllers\Api\V1\Admin;

use App\Enums\SectionType;
use App\Http\Controllers\Controller;
use App\Models\HomepageSection;
use App\Services\Content\HomepageService;
use App\Services\Content\SectionSchema;
use App\Support\PreviewToken;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\Rule;

class HomepageController extends Controller
{
    public function __construct(private readonly HomepageService $homepage) {}

    public function index(): JsonResponse
    {
        $sections = HomepageSection::query()->with('editor:id,name')->orderBy('draft_sort_order')->get();

        return response()->json([
            'data' => $sections->map(fn (HomepageSection $s) => $this->present($s)),
            'meta' => [
                'has_unpublished_changes' => $this->homepage->hasUnpublishedChanges(),
                'last_published_at' => $sections->max('published_at')?->toIso8601String(),
                'types' => collect(SectionType::cases())->map(fn ($t) => [
                    'value' => $t->value, 'label' => $t->label(), 'defaults' => SectionSchema::defaults($t),
                ]),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $data = $request->validate([
            'type' => ['required', Rule::enum(SectionType::class)],
            'name' => ['required', 'string', 'max:150'],
            'config' => ['nullable', 'array'],
            'starts_at' => ['nullable', 'date'],
            'ends_at' => ['nullable', 'date', 'after:starts_at'],
        ]);
        $section = $this->homepage->create(SectionType::from($data['type']), $data['name'], $data['config'] ?? [], $data);

        return response()->json(['data' => $this->present($section)], 201);
    }

    public function update(Request $request, HomepageSection $section): JsonResponse
    {
        $data = $request->validate([
            'name' => ['sometimes', 'string', 'max:150'],
            'config' => ['sometimes', 'array'],
            'is_enabled' => ['sometimes', 'boolean'],
            'starts_at' => ['sometimes', 'nullable', 'date'],
            'ends_at' => ['sometimes', 'nullable', 'date', 'after:starts_at'],
        ]);

        return response()->json(['data' => $this->present($this->homepage->update($section, $data))]);
    }

    public function destroy(HomepageSection $section): JsonResponse
    {
        $this->homepage->remove($section);

        return response()->json(null, 204);
    }

    public function restore(HomepageSection $section): JsonResponse
    {
        $this->homepage->restore($section);

        return response()->json(['data' => $this->present($section->fresh())]);
    }

    public function reorder(Request $request): JsonResponse
    {
        $data = $request->validate(['ids' => ['required', 'array'], 'ids.*' => ['integer', 'exists:homepage_sections,id']]);
        $this->homepage->reorder($data['ids']);

        return response()->json(null, 204);
    }

    public function publish(): JsonResponse
    {
        $count = $this->homepage->publish();

        return response()->json(['data' => ['published_sections' => $count, 'published_at' => now()->toIso8601String()]]);
    }

    public function discard(): JsonResponse
    {
        $this->homepage->discardDraft();

        return response()->json(null, 204);
    }

    public function previewToken(Request $request): JsonResponse
    {
        return response()->json(['data' => ['token' => PreviewToken::issue('homepage', $request->user()->id), 'path' => '/']]);
    }

    private function present(HomepageSection $s): array
    {
        return [
            'id' => $s->id,
            'type' => $s->type->value,
            'type_label' => $s->type->label(),
            'name' => $s->name,
            'config' => $s->draft_config,
            'is_enabled' => $s->draft_is_enabled,
            'sort_order' => $s->draft_sort_order,
            'is_published' => $s->is_published,
            'live_is_enabled' => $s->is_enabled,
            'pending_removal' => $s->pending_removal,
            'has_unpublished_changes' => $s->hasUnpublishedChanges(),
            'starts_at' => $s->starts_at?->toIso8601String(),
            'ends_at' => $s->ends_at?->toIso8601String(),
            'published_at' => $s->published_at?->toIso8601String(),
            'updated_by' => $s->relationLoaded('editor') ? $s->editor?->name : null,
            'updated_at' => $s->updated_at?->toIso8601String(),
        ];
    }
}
