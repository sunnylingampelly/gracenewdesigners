<?php

namespace Database\Seeders;

use App\Enums\ProductStatus;
use App\Models\Attribute;
use App\Models\Category;
use App\Models\Collection;
use App\Models\Department;
use App\Models\Lookbook;
use App\Models\Occasion;
use App\Models\Product;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Services\Catalog\ProductService;
use Database\Seeders\Support\PlaceholderMedia;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * FICTIONAL development catalogue. Every product, price and image here is a fixture for building and
 * testing the platform — not Grace New Designers inventory. All products carry the "Sample" tag and an
 * internal note, and all imagery is generated placeholder art stored in the "placeholders" folder.
 */
class DemoCatalogSeeder extends Seeder
{
    private const NOTE = 'DEVELOPMENT FIXTURE — fictional product, price and imagery. Replace or delete before launch.';

    public function run(ProductService $service): void
    {
        if (Product::query()->where('internal_notes', self::NOTE)->exists()) {
            $this->command?->info('Demo catalogue already present — skipping.');

            return;
        }

        $collections = $this->collections();
        $sizeIds = ProductOptionValue::query()->where('product_option_id', ProductOption::idFor('size'))->pluck('id', 'label');
        $colors = ProductOptionValue::query()->where('product_option_id', ProductOption::idFor('color'))->get()->keyBy('label');
        $fabric = Attribute::query()->where('code', 'fabric')->with('values')->first();
        $work = Attribute::query()->where('code', 'work-type')->with('values')->first();

        $sizeSets = [
            'w' => ['S', 'M', 'L', 'XL'],
            'w-wide' => ['XS', 'S', 'M', 'L', 'XL', 'XXL'],
            'w-small' => ['XS', 'S', 'M', 'L'],
            'm' => ['38', '40', '42', '44'],
            'm-wide' => ['36', '38', '40', '42', '44', '46'],
            'free' => ['Free Size'],
        ];

        foreach ($this->products() as $index => $p) {
            [$name, $categoryPath, $collectionSlugs, $occasionSlugs, $tags, $mode, $price, $colorNames, $sizeSet, $fabrics, $works, $options] = $p;
            $category = Category::query()->where('path', $categoryPath)->firstOrFail();
            $sku = 'GND-'.Str::upper(Str::substr(Str::slug(explode('/', $categoryPath)[1], ''), 0, 3)).'-'.str_pad((string) ($index + 1), 3, '0', STR_PAD_LEFT);
            $madeToOrder = $options['mto'] ?? false;

            // Placeholder imagery: one front and one alternate view per product, tinted by its first colour.
            $hex = $colors[$colorNames[0]]->hex ?? '#285A87';
            $front = PlaceholderMedia::make($name, $hex, $this->shade($hex, -0.45), 1200, 1500, "{$name} — placeholder front view");
            $back = PlaceholderMedia::make($name.' detail', $this->shade($hex, 0.25), $hex, 1200, 1500, "{$name} — placeholder detail view");

            $variants = [];
            $n = 0;
            foreach ($colorNames as $ci => $colorName) {
                foreach ($sizeSets[$sizeSet] as $size) {
                    $n++;
                    // Deterministic stock: some combinations deliberately out of stock.
                    $stock = $madeToOrder ? 0 : (($index + $n) % 7 === 0 ? 0 : (($index * 3 + $n) % 5) + 1);
                    $variants[] = [
                        'sku' => $sku.'-'.Str::upper(Str::slug($size, '')).'-'.Str::upper(Str::substr(Str::slug($colorName, ''), 0, 3)),
                        'size_value_id' => $sizeIds[$size],
                        'color_value_id' => $colors[$colorName]->id,
                        'price' => isset($options['size_premium']) && in_array($size, ['XXL', 'XXXL', '46'], true) ? $price + $options['size_premium'] : null,
                        'stock_quantity' => $stock,
                        'stock_policy' => $madeToOrder ? 'made_to_order' : 'track',
                        'low_stock_threshold' => 1,
                        'is_active' => true,
                        'media_asset_id' => $ci === 0 ? $front->id : null,
                    ];
                }
            }

            $status = $options['status'] ?? 'published';
            $product = $service->create([
                'name' => $name,
                'sku' => $sku,
                'short_description' => $options['short'] ?? $this->shortDescription($name, $fabrics, $works),
                'description' => '<p>'.e($this->longDescription($name, $fabrics, $works)).'</p><p><em>Sample listing for development — not a real product.</em></p>',
                'department_id' => $category->department_id,
                'status' => 'draft',
                'price_mode' => $mode,
                'price' => $mode === 'on_request' ? null : $price,
                'compare_at_price' => $options['compare'] ?? null,
                'currency' => 'INR',
                'is_featured' => $options['featured'] ?? false,
                'is_new_arrival' => $options['new'] ?? false,
                'is_bestseller' => $options['bestseller'] ?? false,
                'is_exclusive' => $options['exclusive'] ?? false,
                'recommendation_priority' => $options['priority'] ?? 0,
                'allows_custom_size' => $options['custom'] ?? false,
                'is_made_to_order' => $madeToOrder,
                'lead_time_min_days' => $madeToOrder ? 28 : null,
                'lead_time_max_days' => $madeToOrder ? 42 : null,
                'set_includes' => $options['set'] ?? null,
                'craftsmanship' => $works ? 'Hand-finished '.Str::lower(implode(' and ', $works)).' detailing by artisan karigars. (Sample copy.)' : null,
                'care_instructions' => 'Dry clean only. Store folded in a muslin bag away from direct sunlight.',
                'delivery_notes' => $madeToOrder
                    ? 'Crafted to order. Timelines are confirmed on WhatsApp before production begins.'
                    : 'Ready pieces are dispatched after availability is confirmed on WhatsApp.',
                'country_of_origin' => 'India',
                'internal_notes' => self::NOTE,
                'category_ids' => [$category->id],
                'primary_category_id' => $category->id,
                'collection_ids' => collect($collectionSlugs)->map(fn ($s) => $collections[$s]->id)->all(),
                'occasion_ids' => Occasion::query()->whereIn('slug', $occasionSlugs)->pluck('id')->all(),
                'tags' => ['Sample', ...$tags],
                'variants' => $variants,
                'media' => [
                    ['media_asset_id' => $front->id, 'role' => 'gallery', 'alt_text' => "{$name} — placeholder front view"],
                    ['media_asset_id' => $back->id, 'role' => 'alternate', 'alt_text' => "{$name} — placeholder detail view"],
                ],
                'attributes' => array_values(array_filter([
                    $fabric ? ['attribute_id' => $fabric->id, 'value_ids' => $fabric->values->whereIn('value', $fabrics)->pluck('id')->all()] : null,
                    $work && $works ? ['attribute_id' => $work->id, 'value_ids' => $work->values->whereIn('value', $works)->pluck('id')->all()] : null,
                ])),
            ]);

            if ($status === 'published') {
                $service->changeStatus($product, ProductStatus::Published, now()->subDays(60 - $index)->toDateTimeString());
            } elseif ($status === 'scheduled') {
                $service->changeStatus($product, ProductStatus::Scheduled, now()->addDays(14)->toDateTimeString());
            }
            $this->command?->getOutput()->write('.');
        }
        $this->command?->newLine();

        $this->relateProducts();
        $this->collectionCovers($collections);
        $this->taxonomyImagery();
        $this->lookbook($collections);
    }

    /** @return array<string, Collection> */
    private function collections(): array
    {
        $data = [
            'neelam-signature' => ['Neelam — The Signature Collection', 'Midnight blues and moonlit ivories.', 'A study of indigo dusk: hand-embroidered silks in midnight, royal and sky blue, finished with restrained gold. (Sample collection copy.)', true],
            'wedding-edit' => ['The Wedding Edit', 'Heirloom pieces for every ceremony.', 'Considered silhouettes for the days that matter most — from haldi to reception. (Sample collection copy.)', true],
            'festive-edit' => ['Festive Edit', 'Colour, craft and celebration.', 'Jewel tones and joyful textures for festivals and family gatherings. (Sample collection copy.)', false],
            'soiree' => ['Soirée', 'Evening occasionwear, distilled.', 'Draped gowns, capes and contemporary sets for cocktail hours. (Sample collection copy.)', false],
        ];
        $result = [];
        $i = 0;
        foreach ($data as $slug => [$name, $tagline, $story, $featured]) {
            $result[$slug] = Collection::query()->firstOrCreate(['slug' => $slug], [
                'name' => $name, 'tagline' => $tagline, 'story' => $story,
                'is_published' => true, 'is_featured' => $featured, 'sort_order' => $i++,
            ]);
        }

        return $result;
    }

    private function products(): array
    {
        // name, category, collections, occasions, tags, price mode, price, colours, size set, fabric, work, options
        return [
            ['Neelam Midnight Silk Lehenga Set', 'women/lehengas', ['neelam-signature', 'wedding-edit'], ['reception', 'sangeet'], ['Embroidered', 'Silk', 'Premium'], 'fixed', 64500, ['Midnight Blue', 'Ivory'], 'w', ['Raw Silk'], ['Zardozi'], ['featured' => true, 'new' => true, 'custom' => true, 'priority' => 10, 'set' => 'Lehenga, blouse and dupatta', 'compare' => 69500]],
            ['Ambar Blush Organza Lehenga', 'women/lehengas', ['wedding-edit'], ['engagement', 'mehendi'], ['Organza', 'Pastel'], 'starting_from', 48000, ['Blush Pink', 'Sage'], 'w-small', ['Organza'], ['Resham'], ['custom' => true, 'set' => 'Lehenga, blouse and dupatta']],
            ['Rangoli Emerald Velvet Lehenga', 'women/lehengas', ['festive-edit'], ['sangeet', 'reception'], ['Velvet', 'Winter'], 'fixed', 72000, ['Emerald', 'Wine'], 'w-wide', ['Velvet'], ['Dabka'], ['bestseller' => true, 'size_premium' => 3000, 'set' => 'Lehenga, blouse and dupatta']],
            ['Chandni Ivory Tulle Lehenga', 'women/lehengas', ['neelam-signature'], ['reception'], ['Tulle', 'Couture'], 'on_request', null, ['Ivory'], 'w', ['Tulle'], ['Pearl', 'Sequin'], ['mto' => true, 'exclusive' => true, 'custom' => true]],
            ['Varuna Sky Blue Organza Saree', 'women/sarees', ['neelam-signature'], ['festive', 'mehendi'], ['Hand-painted', 'Organza'], 'fixed', 18900, ['Sky Blue'], 'free', ['Organza'], ['Hand-painted'], ['new' => true, 'featured' => true, 'priority' => 8, 'set' => 'Saree with unstitched blouse fabric']],
            ['Kesar Gold Banarasi Saree', 'women/sarees', ['wedding-edit'], ['wedding', 'festive'], ['Banarasi', 'Heritage'], 'fixed', 32500, ['Gold', 'Ruby Red'], 'free', ['Banarasi Silk'], ['Zardozi'], ['bestseller' => true, 'set' => 'Saree with unstitched blouse fabric']],
            ['Shyama Black Sequin Saree', 'women/sarees', ['soiree'], ['party'], ['Sequin', 'Evening'], 'fixed', 24800, ['Black'], 'free', ['Georgette'], ['Sequin'], ['set' => 'Saree with stitched blouse']],
            ['Megh Silver Grey Chiffon Saree', 'women/sarees', [], ['casual-luxury'], ['Chikankari', 'Lightweight'], 'fixed', 14500, ['Silver Grey', 'Mauve'], 'free', ['Chiffon'], ['Chikankari'], []],
            ['Noor Royal Blue Anarkali Set', 'women/anarkalis', ['neelam-signature', 'festive-edit'], ['festive', 'sangeet'], ['Gota Patti'], 'fixed', 26500, ['Royal Blue', 'Teal'], 'w', ['Georgette'], ['Gota Patti'], ['new' => true, 'set' => 'Anarkali, churidar and dupatta']],
            ['Gulnaar Ruby Anarkali Gown', 'women/anarkalis', ['wedding-edit'], ['reception'], ['Velvet'], 'fixed', 38000, ['Ruby Red'], 'w-small', ['Velvet'], ['Zardozi'], ['custom' => true]],
            ['Mehr Sage Chanderi Suit', 'women/salwar-suits', [], ['mehendi', 'casual-luxury'], ['Chanderi'], 'fixed', 12900, ['Sage', 'Ivory'], 'w-wide', ['Chanderi'], ['Resham'], ['set' => 'Kurta, salwar and dupatta']],
            ['Aarohi Ivory Chikankari Kurta Set', 'women/kurta-sets', ['festive-edit'], ['casual-luxury', 'festive'], ['Chikankari', 'Everyday'], 'fixed', 9800, ['Ivory', 'Sky Blue'], 'w-wide', ['Linen'], ['Chikankari'], ['new' => true, 'bestseller' => true, 'set' => 'Kurta and palazzo']],
            ['Tara Navy Draped Gown', 'women/gowns', ['soiree', 'neelam-signature'], ['party', 'reception'], ['Draped', 'Evening'], 'fixed', 34500, ['Navy Blue'], 'w-small', ['Crepe'], ['Sequin'], ['featured' => true, 'priority' => 6]],
            ['Ira Champagne Pearl Gown', 'women/gowns', ['soiree'], ['reception'], ['Pearl', 'Couture'], 'on_request', null, ['Champagne'], 'w', ['Tulle'], ['Pearl'], ['mto' => true, 'custom' => true]],
            ['Saanjh Mauve Midi Dress', 'women/dresses', ['soiree'], ['party', 'casual-luxury'], ['Contemporary'], 'fixed', 11500, ['Mauve', 'Teal'], 'w-wide', ['Georgette'], ['Resham'], []],
            ['Phulkari Rose Sharara Set', 'women/sharara-sets', ['festive-edit'], ['mehendi', 'sangeet'], ['Gota Patti', 'Festive'], 'fixed', 21000, ['Rose', 'Gold'], 'w', ['Georgette'], ['Gota Patti'], ['bestseller' => true, 'set' => 'Kurta, sharara and dupatta']],
            ['Lehar Teal Co-ord Set', 'women/co-ord-sets', [], ['casual-luxury'], ['Mirror Work', 'Contemporary'], 'fixed', 13800, ['Teal'], 'w-wide', ['Crepe'], ['Mirror Work'], ['new' => true, 'set' => 'Top and trousers']],
            ['Zoya Midnight Cape Set', 'women/indo-western-wear', ['soiree', 'neelam-signature'], ['party', 'reception'], ['Cape', 'Contemporary'], 'starting_from', 29000, ['Midnight Blue', 'Black'], 'w-small', ['Crepe'], ['Sequin'], ['set' => 'Cape, bustier and skirt']],
            ['Raghav Ivory Silk Sherwani', 'men/sherwanis', ['wedding-edit'], ['wedding'], ['Groom', 'Silk'], 'fixed', 58000, ['Ivory', 'Champagne'], 'm', ['Raw Silk'], ['Zardozi'], ['featured' => true, 'custom' => true, 'priority' => 7, 'set' => 'Sherwani, kurta and churidar']],
            ['Aditya Navy Velvet Sherwani', 'men/sherwanis', ['neelam-signature'], ['reception', 'wedding'], ['Groom', 'Velvet'], 'on_request', null, ['Navy Blue'], 'm', ['Velvet'], ['Dabka'], ['mto' => true, 'custom' => true, 'exclusive' => true]],
            ['Kabir Sky Blue Linen Kurta Set', 'men/kurta-sets', ['festive-edit'], ['festive', 'mehendi'], ['Linen', 'Everyday'], 'fixed', 8900, ['Sky Blue', 'Ivory'], 'm-wide', ['Linen'], ['Chikankari'], ['new' => true, 'set' => 'Kurta and pyjama']],
            ['Vihaan Wine Silk Kurta Set', 'men/kurta-sets', ['festive-edit'], ['festive', 'sangeet'], ['Silk'], 'fixed', 11200, ['Wine', 'Emerald'], 'm', ['Cotton Silk'], ['Resham'], ['set' => 'Kurta and churidar']],
            ['Arjun Midnight Bandhgala', 'men/bandhgalas', ['soiree'], ['reception', 'party'], ['Tailored'], 'fixed', 27500, ['Midnight Blue', 'Black'], 'm', ['Raw Silk'], [], ['set' => 'Bandhgala and trousers']],
            ['Dev Champagne Nehru Jacket Set', 'men/jacket-sets', ['wedding-edit'], ['engagement'], ['Brocade'], 'fixed', 19500, ['Champagne', 'Sage'], 'm-wide', ['Brocade'], ['Resham'], ['set' => 'Jacket, kurta and pyjama']],
            ['Ayaan Royal Blue Velvet Blazer', 'men/blazers', ['soiree'], ['party', 'reception'], ['Velvet', 'Tailored'], 'fixed', 22000, ['Royal Blue'], 'm', ['Velvet'], [], []],
            ['Rudra Black Draped Indo-Western Set', 'men/indo-western-sets', ['soiree'], ['sangeet', 'party'], ['Contemporary'], 'starting_from', 31000, ['Black'], 'm', ['Crepe'], ['Mirror Work'], ['set' => 'Draped kurta and trousers']],
            ['Rajkumari Ruby Bridal Lehenga', 'bridal/bridal-lehengas', ['wedding-edit', 'neelam-signature'], ['wedding'], ['Bridal', 'Couture'], 'on_request', null, ['Ruby Red', 'Wine'], 'w-small', ['Raw Silk'], ['Zardozi', 'Dabka'], ['mto' => true, 'custom' => true, 'featured' => true, 'exclusive' => true, 'priority' => 9, 'set' => 'Lehenga, blouse and two dupattas']],
            ['Sitara Ivory Bridal Lehenga', 'bridal/bridal-lehengas', ['wedding-edit'], ['wedding', 'reception'], ['Bridal', 'Pearl'], 'on_request', null, ['Ivory', 'Gold'], 'w-small', ['Organza'], ['Pearl', 'Sequin'], ['mto' => true, 'custom' => true, 'set' => 'Lehenga, blouse and dupatta']],
            ['Ganga Gold Bridal Saree', 'bridal/bridal-sarees', ['wedding-edit'], ['wedding'], ['Bridal', 'Banarasi'], 'starting_from', 85000, ['Gold'], 'free', ['Banarasi Silk'], ['Zardozi'], ['mto' => true, 'set' => 'Saree with blouse made to measure']],
            ['Rati Blush Reception Gown', 'bridal/reception-wear', ['wedding-edit'], ['reception'], ['Reception', 'Tulle'], 'fixed', 54000, ['Blush Pink', 'Champagne'], 'w-small', ['Tulle'], ['Sequin'], ['custom' => true, 'new' => true]],
            ['Kanak Champagne Engagement Lehenga', 'bridal/engagement-wear', ['wedding-edit'], ['engagement'], ['Engagement'], 'starting_from', 46000, ['Champagne', 'Sky Blue'], 'w', ['Organza'], ['Resham'], ['custom' => true, 'set' => 'Lehenga, blouse and dupatta']],
            ['Neel Embroidered Organza Dupatta', 'accessories/dupattas', ['neelam-signature'], ['festive'], ['Dupatta'], 'fixed', 6800, ['Sky Blue', 'Ivory'], 'free', ['Organza'], ['Gota Patti'], []],
            ['Mohini Sequin Blouse', 'accessories/blouses', ['soiree'], ['party'], ['Blouse'], 'fixed', 7500, ['Gold', 'Black'], 'w-wide', ['Georgette'], ['Sequin'], ['custom' => true]],
            ['Zari Brocade Potli Bag', 'accessories/potli-bags', ['festive-edit'], ['festive', 'wedding'], ['Potli'], 'fixed', 3900, ['Gold', 'Ruby Red'], 'free', ['Brocade'], ['Zardozi'], []],
            ['Moti Pearl Jewellery Set', 'accessories/jewellery', ['wedding-edit'], ['wedding', 'reception'], ['Jewellery'], 'on_request', null, ['Ivory'], 'free', [], ['Pearl'], ['set' => 'Necklace and earrings']],
            ['Hemant Ivory Sherwani (Draft)', 'men/sherwanis', [], ['wedding'], ['Groom'], 'fixed', 61000, ['Ivory'], 'm', ['Raw Silk'], ['Zardozi'], ['status' => 'draft']],
            ['Basant Mustard Organza Saree (Scheduled)', 'women/sarees', ['festive-edit'], ['festive'], ['Organza'], 'fixed', 17500, ['Gold'], 'free', ['Organza'], ['Gota Patti'], ['status' => 'scheduled']],
        ];
    }

    private function relateProducts(): void
    {
        $lehenga = Product::query()->where('name', 'like', 'Neelam Midnight%')->first();
        if ($lehenga) {
            $ids = Product::query()->whereIn('name', ['Neel Embroidered Organza Dupatta', 'Zari Brocade Potli Bag', 'Moti Pearl Jewellery Set'])->pluck('id')->all();
            app(ProductService::class)->update($lehenga, ['complete_the_look_ids' => $ids]);
        }
    }

    private function collectionCovers(array $collections): void
    {
        $palette = ['neelam-signature' => ['#102E55', '#081B33'], 'wedding-edit' => ['#9B1B30', '#5E1A2E'], 'festive-edit' => ['#C9A54C', '#1E6B4F'], 'soiree' => ['#121212', '#285A87']];
        foreach ($collections as $slug => $collection) {
            [$a, $b] = $palette[$slug];
            $cover = PlaceholderMedia::make($collection->name, $a, $b, 1600, 2000, "{$collection->name} — placeholder campaign image");
            $banner = PlaceholderMedia::make($collection->name.' banner', $b, $a, 2400, 1200, "{$collection->name} — placeholder banner");
            $collection->update(['cover_media_id' => $cover->id, 'banner_media_id' => $banner->id]);
        }
    }

    private function taxonomyImagery(): void
    {
        $tones = ['#285A87', '#102E55', '#79B7DF', '#5E1A2E', '#1E6B4F', '#9C7A97', '#C9A54C'];
        foreach (Category::query()->whereNull('parent_id')->whereHas('products')->get() as $i => $category) {
            $tone = $tones[$i % count($tones)];
            $category->update(['image_media_id' => PlaceholderMedia::make($category->name, $tone, $this->shade($tone, -0.5), 1000, 1250, "{$category->name} — placeholder category image")->id]);
        }
        foreach (Department::query()->get() as $i => $department) {
            $tone = $tones[($i + 2) % count($tones)];
            $department->update(['banner_media_id' => PlaceholderMedia::make($department->name, $tone, $this->shade($tone, -0.55), 2400, 1000, "{$department->name} — placeholder banner")->id]);
        }
        foreach (Occasion::query()->get() as $i => $occasion) {
            $tone = $tones[($i + 4) % count($tones)];
            $occasion->update(['image_media_id' => PlaceholderMedia::make($occasion->name, $this->shade($tone, 0.2), $tone, 1000, 1250, "{$occasion->name} — placeholder occasion image")->id]);
        }
    }

    private function lookbook(array $collections): void
    {
        $lookbook = Lookbook::query()->firstOrCreate(['slug' => 'indigo-dusk'], [
            'title' => 'Indigo Dusk', 'season' => 'Sample Season',
            'description' => 'A placeholder lookbook showing how campaign stories link to collections and products.',
            'collection_id' => $collections['neelam-signature']->id, 'status' => 'published', 'published_at' => now()->subDays(10),
        ]);
        $lookbook->update(['cover_media_id' => PlaceholderMedia::make('Indigo Dusk lookbook', '#081B33', '#285A87', 2400, 1350, 'Indigo Dusk — placeholder lookbook cover')->id]);
        $products = Product::query()->whereHas('collections', fn ($q) => $q->where('slug', 'neelam-signature'))->publiclyVisible()->with('media')->limit(6)->get();
        foreach ($products as $i => $product) {
            $lookbook->items()->create([
                'media_asset_id' => $product->media->first()->media_asset_id,
                'caption' => $product->name,
                'product_id' => $product->id,
                'layout' => $i % 3 === 0 ? 'landscape' : 'portrait',
                'sort_order' => $i,
            ]);
        }
    }

    private function shortDescription(string $name, array $fabrics, array $works): string
    {
        $fabric = $fabrics ? Str::lower(implode(' and ', $fabrics)) : 'fine materials';
        $work = $works ? ' with '.Str::lower(implode(' and ', $works)).' detailing' : '';

        return "A sample piece in {$fabric}{$work}, shown to demonstrate the storefront.";
    }

    private function longDescription(string $name, array $fabrics, array $works): string
    {
        return "{$name} is a fictional listing used to develop and test the Grace New Designers platform. "
            .'It illustrates how fabric, craftsmanship, sizing and delivery information appear on a product page.';
    }

    private function shade(string $hex, float $amount): string
    {
        $hex = ltrim($hex, '#');
        $rgb = array_map(fn ($i) => hexdec(substr($hex, $i, 2)), [0, 2, 4]);
        $rgb = array_map(fn ($c) => (int) max(0, min(255, $amount < 0 ? $c * (1 + $amount) : $c + (255 - $c) * $amount)), $rgb);

        return sprintf('#%02X%02X%02X', ...$rgb);
    }
}
