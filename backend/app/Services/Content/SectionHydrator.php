<?php

namespace App\Services\Content;

use App\Enums\SectionType;
use App\Http\Resources\Storefront\ProductCardResource;
use App\Models\Category;
use App\Models\Collection;
use App\Models\Lookbook;
use App\Models\MediaAsset;
use App\Models\Occasion;
use App\Models\Product;
use App\Models\Testimonial;
use App\Services\Catalog\ProductListingService;

/**
 * Turns a stored section config (ids) into the storefront payload (media URLs, product cards,
 * category links). Sections whose required content is missing or unpublished are dropped.
 */
class SectionHydrator
{
    /** @var array<int, MediaAsset|null> */
    private array $mediaCache = [];

    public function hydrate(int $id, SectionType $type, array $config): ?array
    {
        $data = match ($type) {
            SectionType::HeroImage, SectionType::HeroVideo => $this->withMedia($config, ['desktop_media_id', 'mobile_media_id', 'video_media_id']),
            SectionType::SplitEditorial, SectionType::TextImage, SectionType::BrandStory, SectionType::AppointmentCta => $this->withMedia($config, ['media_id']),
            SectionType::CategoryGrid => $this->categoryGrid($config),
            SectionType::CollectionFeature => $this->collectionFeature($config),
            SectionType::FeaturedProducts => $this->featuredProducts($config),
            SectionType::OccasionGrid => $this->occasionGrid($config),
            SectionType::LookbookGallery => $this->lookbookGallery($config),
            SectionType::Craftsmanship => $this->craftsmanship($config),
            SectionType::Testimonials => $this->testimonials($config),
            SectionType::Newsletter => $config,
            SectionType::SocialGallery => $this->socialGallery($config),
        };

        return $data === null ? null : ['id' => $id, 'type' => $type->value, 'data' => $data];
    }

    private function media(?int $id): ?array
    {
        if (! $id) {
            return null;
        }
        if (! array_key_exists($id, $this->mediaCache)) {
            $this->mediaCache[$id] = MediaAsset::query()->find($id);
        }

        return $this->mediaCache[$id]?->toPublicArray();
    }

    private function withMedia(array $config, array $keys): array
    {
        foreach ($keys as $key) {
            if (array_key_exists($key, $config)) {
                $config[str_replace('_id', '', $key)] = $this->media($config[$key]);
                unset($config[$key]);
            }
        }

        return $config;
    }

    private function categoryGrid(array $config): ?array
    {
        $categories = Category::query()->published()->with('image')->whereIn('id', array_column($config['items'] ?? [], 'category_id'))->get()->keyBy('id');
        $items = collect($config['items'] ?? [])->map(function ($item) use ($categories) {
            $category = $categories->get($item['category_id']);
            if (! $category) {
                return null;
            }

            return [
                'label' => $item['label'] ?? $category->name,
                'url' => '/shop/'.$category->path,
                'media' => $this->media($item['media_id'] ?? null) ?? $category->image?->toPublicArray($category->name),
            ];
        })->filter()->values();

        if ($items->isEmpty()) {
            return null;
        }

        return [...collect($config)->except('items')->all(), 'items' => $items->all()];
    }

    private function collectionFeature(array $config): ?array
    {
        $collection = Collection::query()->visible()->with('cover')->find($config['collection_id'] ?? 0);
        if (! $collection) {
            return null;
        }

        return [
            ...$this->withMedia(collect($config)->except('collection_id')->all(), ['media_id']),
            'title' => $config['title'] ?? $collection->name,
            'body' => $config['body'] ?? $collection->story,
            'media' => $this->media($config['media_id'] ?? null) ?? $collection->cover?->toPublicArray($collection->name),
            'cta_label' => $config['cta_label'] ?? 'Discover the Collection',
            'cta_url' => $config['cta_url'] ?? '/collections/'.$collection->slug,
        ];
    }

    private function featuredProducts(array $config): ?array
    {
        $limit = $config['limit'] ?? 8;
        $query = Product::query()->publiclyVisible()->with(ProductListingService::cardRelations());

        $products = match ($config['source']) {
            'new_arrivals' => $query->orderByDesc('is_new_arrival')->orderByDesc('published_at')->limit($limit)->get(),
            'bestsellers' => $query->orderByDesc('is_bestseller')->orderByRaw('(enquiry_count * 10 + view_count) DESC')->limit($limit)->get(),
            'featured' => $query->where('is_featured', true)->orderByDesc('recommendation_priority')->limit($limit)->get(),
            'collection' => $query->whereHas('collections', fn ($q) => $q->whereKey($config['collection_id']))
                ->join('collection_product as cp', fn ($j) => $j->on('cp.product_id', '=', 'products.id')->where('cp.collection_id', $config['collection_id']))
                ->select('products.*')->orderBy('cp.sort_order')->limit($limit)->get(),
            'manual' => $query->whereIn('id', $config['product_ids'] ?? [])->get()
                ->sortBy(fn ($p) => array_search($p->id, $config['product_ids'] ?? []))->values(),
        };

        if ($products->isEmpty()) {
            return null;
        }

        return [
            ...collect($config)->except(['product_ids', 'collection_id'])->all(),
            'products' => ProductCardResource::collection($products)->resolve(),
        ];
    }

    private function occasionGrid(array $config): ?array
    {
        $ids = $config['occasion_ids'] ?? [];
        $occasions = Occasion::query()->where('is_published', true)->with('image')
            ->when($ids, fn ($q) => $q->whereIn('id', $ids))
            ->orderBy('sort_order')->get();
        if ($ids) {
            $occasions = $occasions->sortBy(fn ($o) => array_search($o->id, $ids))->values();
        }
        if ($occasions->isEmpty()) {
            return null;
        }

        return [
            ...collect($config)->except('occasion_ids')->all(),
            'items' => $occasions->map(fn (Occasion $o) => [
                'label' => $o->name,
                'url' => '/occasions/'.$o->slug,
                'media' => $o->image?->toPublicArray($o->name),
            ])->all(),
        ];
    }

    private function lookbookGallery(array $config): ?array
    {
        $items = collect($config['items'] ?? [])->map(fn ($item) => [
            'media' => $this->media($item['media_id']),
            'caption' => $item['caption'] ?? null,
            'url' => $item['link_url'] ?? null,
        ]);

        if (! empty($config['lookbook_id'])) {
            $lookbook = Lookbook::query()->publiclyVisible()->with(['items.asset', 'items.product', 'items.collection'])->find($config['lookbook_id']);
            if ($lookbook) {
                $items = $items->merge($lookbook->items->take(8)->map(fn ($item) => [
                    'media' => $item->asset?->toPublicArray($item->caption),
                    'caption' => $item->caption,
                    'url' => $item->product ? '/products/'.$item->product->slug
                        : ($item->collection ? '/collections/'.$item->collection->slug : '/lookbook/'.$lookbook->slug),
                ]));
                $config['cta_url'] ??= '/lookbook/'.$lookbook->slug;
            }
        }
        $items = $items->filter(fn ($i) => $i['media'])->values();
        if ($items->isEmpty()) {
            return null;
        }

        return [...collect($config)->except(['items', 'lookbook_id'])->all(), 'items' => $items->all()];
    }

    private function craftsmanship(array $config): array
    {
        $config = $this->withMedia($config, ['media_id']);
        $config['pillars'] = collect($config['pillars'] ?? [])->map(fn ($p) => [
            'title' => $p['title'],
            'body' => $p['body'] ?? null,
            'media' => $this->media($p['media_id'] ?? null),
        ])->all();

        return $config;
    }

    /** Only approved testimonials with recorded consent; the section disappears when there are none. */
    private function testimonials(array $config): ?array
    {
        $items = Testimonial::query()->publishable()->with('image')->limit($config['limit'] ?? 6)->get();
        if ($items->isEmpty()) {
            return null;
        }

        return [
            ...$config,
            'items' => $items->map(fn (Testimonial $t) => [
                'quote' => $t->quote,
                'author' => $t->author_name,
                'location' => $t->location,
                'occasion' => $t->occasion,
                'media' => $t->image?->toPublicArray($t->author_name),
            ])->all(),
        ];
    }

    private function socialGallery(array $config): ?array
    {
        $items = collect($config['items'] ?? [])->map(fn ($item) => [
            'media' => $this->media($item['media_id']),
            'url' => $item['link_url'] ?? null,
            'alt' => $item['alt'] ?? null,
        ])->filter(fn ($i) => $i['media'])->values();

        if ($items->isEmpty()) {
            return null;
        }

        return [...collect($config)->except('items')->all(), 'items' => $items->all()];
    }
}
