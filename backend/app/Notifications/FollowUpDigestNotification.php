<?php

namespace App\Notifications;

use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

class FollowUpDigestNotification extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param list<string> $references */
    public function __construct(public array $references) {}

    public function via(object $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(object $notifiable): MailMessage
    {
        $mail = (new MailMessage)
            ->subject(count($this->references).' enquiry follow-up(s) due today')
            ->line('These enquiries assigned to you are due or overdue for follow-up:');
        foreach (array_slice($this->references, 0, 30) as $reference) {
            $mail->line('• '.$reference);
        }

        return $mail->action('Open enquiries', rtrim(config('app.frontend_url'), '/').'/admin/enquiries?follow_up=overdue');
    }
}
