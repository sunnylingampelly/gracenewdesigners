<?php

namespace App\Enums;

enum EnquiryType: string
{
    case Product = 'product';
    case Bag = 'bag';
    case Consultation = 'consultation';
    case Contact = 'contact';
}
