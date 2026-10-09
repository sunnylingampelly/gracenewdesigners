<?php

namespace App\Notifications;

use App\Models\Enquiry;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Internal alert to the boutique team. Contains catalogue details and a link to the admin —
 * not the customer's contact details, which stay inside the authenticated admin.
 */
class NewEnquiryNotification extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(public Enquiry $enquiry) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $this->enquiry->loadMissing('items');
        $mail = (new MailMessage)
            ->subject("New enquiry initiated: {$this->enquiry->reference}")
            ->line("A visitor initiated a {$this->enquiry->type->value} enquiry on the website.")
            ->line('Note: this means the WhatsApp handoff was started; it does not confirm a message was sent.');

        foreach ($this->enquiry->items as $item) {
            $mail->line("• {$item->product_name} ({$item->product_sku})".($item->size_label ? " — {$item->size_label}" : '').($item->color_label ? " / {$item->color_label}" : '')." × {$item->quantity}");
        }

        return $mail->action('Open in admin', rtrim(config('app.frontend_url'), '/').'/admin/enquiries/'.$this->enquiry->id);
    }
}
