<?php

namespace App\Http\Requests\Storefront;

use App\Enums\EnquiryType;
use Illuminate\Foundation\Http\FormRequest;
use Illuminate\Validation\Rule;

class StoreEnquiryRequest extends FormRequest
{
    public function rules(): array
    {
        $hasContact = fn () => filled($this->input('customer.phone')) || filled($this->input('customer.email'));

        return [
            'type' => ['required', Rule::enum(EnquiryType::class)],
            'items' => ['array', 'max:20', Rule::requiredIf(in_array($this->input('type'), ['product', 'bag'], true))],
            'items.*.product_id' => ['required', 'integer'],
            'items.*.variant_id' => ['nullable', 'integer'],
            'items.*.color_value_id' => ['nullable', 'integer'],
            'items.*.custom_size' => ['nullable', 'boolean'],
            'items.*.quantity' => ['required', 'integer', 'min:1', 'max:10'],

            'customer' => ['nullable', 'array'],
            'customer.name' => ['nullable', 'string', 'max:150'],
            'customer.phone' => ['nullable', 'string', 'max:32', 'regex:/^\+?[0-9\s\-()]{7,20}$/'],
            'customer.email' => ['nullable', 'email:rfc', 'max:190'],
            'customer.city' => ['nullable', 'string', 'max:120'],
            'customer.country' => ['nullable', 'string', 'max:80'],
            'customer.message' => ['nullable', 'string', 'max:2000'],
            'customer.marketing_consent' => ['nullable', 'boolean'],
            // Personal details are only stored with explicit privacy consent.
            'privacy_consent' => Rule::when($hasContact, ['required', 'accepted'], ['nullable', 'boolean']),

            'measurements' => ['nullable', 'array', 'max:12'],
            'measurements.*' => ['nullable', 'string', 'max:60'],
            'fitting_consultation' => ['nullable', 'boolean'],
            'preferred_date' => ['nullable', 'date', 'after_or_equal:today', 'before:+1 year'],

            'source_path' => ['nullable', 'string', 'max:500'],
            'referrer' => ['nullable', 'string', 'max:500'],
            'attribution_consent' => ['nullable', 'boolean'],
            'utm' => ['nullable', 'array'],
            'utm.source' => ['nullable', 'string', 'max:100'],
            'utm.medium' => ['nullable', 'string', 'max:100'],
            'utm.campaign' => ['nullable', 'string', 'max:150'],
            'utm.content' => ['nullable', 'string', 'max:150'],
            'utm.term' => ['nullable', 'string', 'max:150'],

            // Honeypot: real visitors never see or fill this field.
            'website' => ['prohibited'],
        ];
    }

    public function messages(): array
    {
        return [
            'privacy_consent.accepted' => 'Please agree to the privacy notice so we can store your contact details.',
            'privacy_consent.required' => 'Please agree to the privacy notice so we can store your contact details.',
            'website.prohibited' => 'Your enquiry could not be submitted.',
        ];
    }

    protected function prepareForValidation(): void
    {
        // Measurements only make sense with a custom-size request; drop them otherwise.
        $custom = collect($this->input('items', []))->contains(fn ($i) => ! empty($i['custom_size']));
        $drop = [];
        if (! $custom && $this->input('type') !== 'consultation') {
            $drop[] = 'measurements';
        }
        if (blank($this->input('website'))) {
            $drop[] = 'website';
        }
        if ($drop) {
            $this->replace($this->except($drop));
        }
    }

    public function validated($key = null, $default = null)
    {
        $data = parent::validated($key, $default);
        if ($key === null && ! $this->boolean('privacy_consent')) {
            unset($data['customer'], $data['measurements']);
        }

        return $data;
    }
}
