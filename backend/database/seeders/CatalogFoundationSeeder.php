<?php

namespace Database\Seeders;

use App\Models\Attribute;
use App\Models\Category;
use App\Models\Department;
use App\Models\Occasion;
use App\Models\ProductOption;
use App\Models\ProductOptionValue;
use App\Models\SizeChart;
use Illuminate\Database\Seeder;
use Illuminate\Support\Str;

/**
 * Initial taxonomy, option dictionaries and attribute schema. All of it is editable in the admin;
 * nothing here limits what the catalogue can hold later.
 */
class CatalogFoundationSeeder extends Seeder
{
    public function run(): void
    {
        $this->options();
        $this->attributes();
        $charts = $this->sizeCharts();
        $this->taxonomy($charts);
        $this->occasions();
    }

    private function options(): void
    {
        $size = ProductOption::query()->firstOrCreate(['code' => 'size'], ['name' => 'Size', 'sort_order' => 1]);
        $color = ProductOption::query()->firstOrCreate(['code' => 'color'], ['name' => 'Colour', 'sort_order' => 2]);

        $sizes = [
            ['XS', 'Alpha'], ['S', 'Alpha'], ['M', 'Alpha'], ['L', 'Alpha'], ['XL', 'Alpha'], ['XXL', 'Alpha'], ['XXXL', 'Alpha'],
            ['36', 'Menswear chest'], ['38', 'Menswear chest'], ['40', 'Menswear chest'], ['42', 'Menswear chest'], ['44', 'Menswear chest'], ['46', 'Menswear chest'],
            ['Free Size', 'Free size'],
        ];
        foreach ($sizes as $i => [$label, $group]) {
            ProductOptionValue::query()->firstOrCreate(
                ['product_option_id' => $size->id, 'code' => Str::slug($label)],
                ['label' => $label, 'size_group' => $group, 'sort_order' => $i]
            );
        }
        // "Custom Size" is offered per product (allows_custom_size) and requested through the enquiry,
        // but is kept in the dictionary so staff can record it on orders consistently.
        ProductOptionValue::query()->firstOrCreate(
            ['product_option_id' => $size->id, 'code' => 'custom-size'],
            ['label' => 'Custom Size', 'size_group' => 'Made to measure', 'is_custom' => true, 'sort_order' => 99]
        );

        $colors = [
            'Ivory' => '#F4EFE3', 'Champagne' => '#E8D9B5', 'Gold' => '#C9A54C', 'Blush Pink' => '#E8B9B5',
            'Rose' => '#C9707D', 'Ruby Red' => '#9B1B30', 'Wine' => '#5E1A2E', 'Mauve' => '#9C7A97',
            'Sky Blue' => '#79B7DF', 'Royal Blue' => '#285A87', 'Navy Blue' => '#102E55', 'Midnight Blue' => '#081B33',
            'Teal' => '#1F6F6B', 'Emerald' => '#1E6B4F', 'Sage' => '#9AAE91', 'Black' => '#121212', 'Silver Grey' => '#B9BCC2',
        ];
        $i = 0;
        foreach ($colors as $label => $hex) {
            ProductOptionValue::query()->firstOrCreate(
                ['product_option_id' => $color->id, 'code' => Str::slug($label)],
                ['label' => $label, 'hex' => $hex, 'sort_order' => $i++]
            );
        }
    }

    private function attributes(): void
    {
        $definitions = [
            ['Fabric', 'fabric', 'multiselect', 'details', true, ['Silk', 'Banarasi Silk', 'Raw Silk', 'Organza', 'Georgette', 'Chiffon', 'Crepe', 'Velvet', 'Chanderi', 'Tulle', 'Brocade', 'Cotton Silk', 'Linen']],
            ['Work Type', 'work-type', 'multiselect', 'craft', true, ['Zardozi', 'Gota Patti', 'Resham', 'Sequin', 'Mirror Work', 'Chikankari', 'Aari', 'Dabka', 'Hand-painted', 'Pearl']],
            ['Pattern', 'pattern', 'select', 'details', false, ['Solid', 'Floral', 'Geometric', 'Paisley', 'Abstract', 'Stripes']],
            ['Lining', 'lining', 'text', 'details', false, []],
            ['Neckline', 'neckline', 'select', 'details', false, ['V-neck', 'Sweetheart', 'Round', 'Boat', 'High neck', 'Mandarin collar']],
            ['Sleeves', 'sleeves', 'select', 'details', false, ['Sleeveless', 'Cap', 'Short', 'Elbow', 'Three-quarter', 'Full']],
        ];
        foreach ($definitions as $i => [$name, $code, $type, $group, $filterable, $values]) {
            $attribute = Attribute::query()->firstOrCreate(['code' => $code], [
                'name' => $name, 'type' => $type, 'group' => $group, 'is_filterable' => $filterable, 'sort_order' => $i,
            ]);
            foreach ($values as $j => $value) {
                $attribute->values()->firstOrCreate(['slug' => Str::slug($value)], ['value' => $value, 'sort_order' => $j]);
            }
        }
    }

    /** @return array<string, SizeChart> */
    private function sizeCharts(): array
    {
        $guide = "Measure over light clothing with a soft tape held snug but not tight.\n"
            ."Bust: around the fullest part of the chest.\nWaist: around the natural waistline.\n"
            ."Hip: around the fullest part of the hips.\nIf you are between sizes, choose Custom Size or request a fitting consultation.";

        return [
            'women' => SizeChart::query()->firstOrCreate(['slug' => 'womenswear-alpha'], [
                'name' => 'Womenswear (XS–XXXL)', 'unit' => 'in',
                'description' => 'Body measurements in inches. Garments include ease for comfort.',
                'chart' => ['columns' => ['Size', 'Bust', 'Waist', 'Hip'], 'rows' => [
                    ['XS', '32', '26', '35'], ['S', '34', '28', '37'], ['M', '36', '30', '39'], ['L', '38', '32', '41'],
                    ['XL', '40', '34', '43'], ['XXL', '42', '36', '45'], ['XXXL', '44', '38', '47'],
                ]],
                'measurement_guide' => $guide,
            ]),
            'men' => SizeChart::query()->firstOrCreate(['slug' => 'menswear-chest'], [
                'name' => 'Menswear (chest sizes)', 'unit' => 'in',
                'description' => 'Body measurements in inches.',
                'chart' => ['columns' => ['Size', 'Chest', 'Waist', 'Shoulder'], 'rows' => [
                    ['36', '36', '30', '16.5'], ['38', '38', '32', '17'], ['40', '40', '34', '17.5'],
                    ['42', '42', '36', '18'], ['44', '44', '38', '18.5'], ['46', '46', '40', '19'],
                ]],
                'measurement_guide' => "Chest: around the fullest part under the arms.\nWaist: where you wear your trousers.\nShoulder: seam to seam across the back.",
            ]),
            'free' => SizeChart::query()->firstOrCreate(['slug' => 'free-size'], [
                'name' => 'Free size', 'unit' => 'in',
                'description' => 'Sarees and dupattas are free size. Blouses are made to your measurements on request.',
                'chart' => ['columns' => ['Piece', 'Length', 'Width'], 'rows' => [['Saree', '216', '45'], ['Dupatta', '96', '40'], ['Blouse fabric', '32', '45']]],
                'measurement_guide' => $guide,
            ]),
        ];
    }

    /** @param array<string, SizeChart> $charts */
    private function taxonomy(array $charts): void
    {
        $tree = [
            'Wedding Collection' => ['chart' => 'men', 'children' => ['Sherwanis' => null, 'Bandhgalas' => null, 'Indo-Western Sets' => null, 'Kurta Sets' => null]],
            'Formal Wear' => ['chart' => 'men', 'children' => ['Suits' => null, 'Blazers' => null, 'Tuxedos' => null, 'Waistcoats' => null]],
            'Ethnic Wear' => ['chart' => 'men', 'children' => ['Kurta Pajamas' => null, 'Pathani Suits' => null, 'Nehru Jackets' => null, 'Jodhpuri Suits' => null]],
            'Accessories' => ['chart' => 'free', 'children' => ['Pocket Squares' => null, 'Stoles' => null, 'Turbans' => null, 'Brooches' => null, 'Cufflinks' => null]],
        ];

        $d = 0;
        foreach ($tree as $departmentName => $config) {
            $department = Department::query()->firstOrCreate(['slug' => Str::slug($departmentName)], [
                'name' => $departmentName, 'sort_order' => $d++, 'is_active' => true,
            ]);
            $c = 0;
            foreach ($config['children'] as $name => $chart) {
                $slug = Str::slug($name);
                if (! Category::query()->where('path', $department->slug.'/'.$slug)->exists()) {
                    Category::query()->create([
                        'department_id' => $department->id,
                        'name' => $name,
                        'slug' => $slug,
                        'size_chart_id' => $charts[$chart ?? $config['chart']]->id ?? null,
                        'sort_order' => $c,
                        'is_published' => true,
                        'show_in_menu' => true,
                        'hide_when_empty' => true,
                    ]);
                }
                $c++;
            }
        }
    }

    private function occasions(): void
    {
        $occasions = [
            'Wedding' => 'Distinguished attire for the ceremony itself - where tradition meets impeccable tailoring.',
            'Reception' => 'Refined evening wear with sophisticated embellishment for the celebration.',
            'Engagement' => 'Statement pieces for marking the commitment with style.',
            'Sangeet' => 'Elegant yet comfortable designs perfect for celebrations with music and dance.',
            'Festive Occasions' => 'Premium ensembles for Diwali, Eid and family gatherings.',
            'Cocktail Parties' => 'Contemporary formal wear for evening events and soirées.',
            'Business Formal' => 'Sharp tailoring for boardrooms and professional events.',
            'Casual Elegant' => 'Refined pieces for everyday sophistication.',
        ];
        $i = 0;
        foreach ($occasions as $name => $description) {
            Occasion::query()->firstOrCreate(['slug' => Str::slug($name)], ['name' => $name, 'description' => $description, 'sort_order' => $i++, 'is_published' => true]);
        }
    }
}
