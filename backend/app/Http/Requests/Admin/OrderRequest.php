<?php

namespace App\Http\Requests\Admin;

use App\Enums\OrderStatus;
use App\Enums\PaymentStatus;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class OrderRequest extends FormRequest
{
    public function authorize(): bool
    {
        return $this->user()->hasPermission('orders.manage');
    }

    public function rules(): array
    {
        $creating = $this->route('order') === null;
        $required = $creating ? 'required' : 'sometimes';

        return [
            'enquiry_id' => [$creating ? 'nullable' : 'prohibited', 'integer', 'exists:enquiries,id'],
            'customer_id' => ['nullable', 'integer', 'exists:customers,id'],
            'status' => ['sometimes', Rule::enum(OrderStatus::class)],
            'status_note' => ['nullable', 'string', 'max:1000'],
            'payment_status' => ['sometimes', Rule::enum(PaymentStatus::class)],
            'payment_note' => ['nullable', 'string', 'max:500'],
            'currency' => ['sometimes', 'string', 'size:3'],
            'discount_amount' => ['sometimes', 'numeric', 'min:0'],
            'shipping_amount' => ['sometimes', 'numeric', 'min:0'],
            'tax_amount' => ['sometimes', 'numeric', 'min:0'],
            'amount_paid' => ['sometimes', 'numeric', 'min:0'],
            'requires_shipping' => ['sometimes', 'boolean'],
            'shipping_name' => ['nullable', 'string', 'max:150'],
            'shipping_phone' => ['nullable', 'string', 'max:32'],
            'shipping_line1' => ['nullable', 'string', 'max:255'],
            'shipping_line2' => ['nullable', 'string', 'max:255'],
            'shipping_city' => ['nullable', 'string', 'max:120'],
            'shipping_state' => ['nullable', 'string', 'max:120'],
            'shipping_postal_code' => ['nullable', 'string', 'max:20'],
            'shipping_country' => ['nullable', 'string', 'max:80'],
            'tracking_carrier' => ['nullable', 'string', 'max:100'],
            'tracking_number' => ['nullable', 'string', 'max:100'],
            'expected_delivery_date' => ['nullable', 'date'],
            'internal_notes' => ['nullable', 'string', 'max:5000'],

            'items' => [$required, 'array', 'min:1', 'max:50'],
            'items.*.product_id' => ['nullable', 'integer', 'exists:products,id'],
            'items.*.product_variant_id' => ['nullable', 'integer', 'exists:product_variants,id'],
            'items.*.product_name' => ['required_without:items.*.product_id', 'nullable', 'string', 'max:255'],
            'items.*.size_label' => ['nullable', 'string', 'max:80'],
            'items.*.color_label' => ['nullable', 'string', 'max:80'],
            'items.*.is_custom_size' => ['sometimes', 'boolean'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:100'],
            'items.*.unit_price' => ['required', 'numeric', 'min:0', 'max:99999999'],
            'items.*.notes' => ['nullable', 'string', 'max:1000'],
        ];
    }

    public function messages(): array
    {
        return [
            'items.*.unit_price.required' => 'Enter the agreed price for every item.',
            'items.*.product_name.required_without' => 'Name the item or choose a product.',
        ];
    }
}
